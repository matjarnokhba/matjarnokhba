import { prisma } from "@/lib/prisma";

const MAX_RETRIES = 100;

async function generateUniqueSlug(
  tx: any,
  sellerId: number,
  base: string
): Promise<string> {
  const clean = base
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80) || "product";
  let slug = clean;
  let counter = 1;
  while (await tx.product.findFirst({ where: { sellerId, slug } })) {
    slug = `${clean}-${counter++}`;
    if (counter > MAX_RETRIES) throw new Error("Cannot generate unique slug");
  }
  return slug;
}

async function generateUniqueSku(
  tx: any,
  sellerId: number,
  base: string
): Promise<string> {
  const clean = (base || "").trim() || `SKU-${Date.now()}`;
  let sku = clean;
  let counter = 1;
  while (await tx.productVariant.findFirst({ where: { sellerId, sku } })) {
    sku = `${clean}-${counter++}`;
    if (counter > MAX_RETRIES) throw new Error("Cannot generate unique SKU");
  }
  return sku;
}

async function resolveBarcode(
  tx: any,
  sellerId: number,
  base: string | null
): Promise<string | null> {
  if (!base) return null;
  const exists = await tx.productVariant.findFirst({
    where: { sellerId, barcode: base },
    select: { id: true },
  });
  return exists ? null : base;
}

export const WholesaleOrderService = {
  async acceptOrder(orderId: number, supplierUserId: number) {
    return prisma.$transaction(
      async (tx) => {
        const order = await tx.wholesaleOrder.findUnique({
          where: { id: orderId },
          include: {
            buyer: {
              select: {
                id: true,
                name: true,
                seller: { select: { id: true, userId: true } },
              },
            },
            supplier: { select: { userId: true, displayName: true } },
            items: {
              include: {
                offer: {
                  include: {
                    master: { select: { id: true } },
                    product: {
                      include: {
                        images: { orderBy: { order: "asc" } },
                        variants: true,
                      },
                    },
                    variants: true,
                  },
                },
                offerVariant: true,
              },
            },
          },
        });

        if (!order) throw new Error("الطلب غير موجود");
        if (order.supplier.userId !== supplierUserId) {
          throw new Error("غير مصرح — لست البائع لهذا الطلب");
        }
        if (order.status !== "PENDING") {
          throw new Error(`لا يمكن قبول طلب بحالة ${order.status}`);
        }
        if (!order.buyer.seller) {
          throw new Error(
            "المشتري ليس لديه متجر تجزئة — لا يمكن استقبال المنتجات"
          );
        }

        const buyerSellerId = order.buyer.seller.id;

        // Group items by offer (each offer = one source product)
        const offerGroup = new Map<
          number,
          {
            offer: typeof order.items[0]["offer"];
            items: typeof order.items;
          }
        >();

        for (const item of order.items) {
          if (!offerGroup.has(item.offerId)) {
            offerGroup.set(item.offerId, { offer: item.offer, items: [] });
          }
          offerGroup.get(item.offerId)!.items.push(item);
        }

        let productsCreated = 0;
        let totalQty = 0;
        const createdProductIds: number[] = [];

        for (const [offerId, { offer, items }] of offerGroup) {
          // ─── 1. Deduct stock atomically per item ───
          for (const item of items) {
            if (item.offerVariantId) {
              const dec = await tx.sellerOfferVariant.updateMany({
                where: {
                  id: item.offerVariantId,
                  stock: { gte: item.qty },
                },
                data: { stock: { decrement: item.qty } },
              });
              if (dec.count === 0) {
                throw new Error(
                  `المخزون غير كافٍ لـ "${item.productName}"`
                );
              }
            } else {
              const variants = await tx.sellerOfferVariant.findMany({
                where: { offerId, stock: { gte: item.qty } },
                orderBy: { stock: "desc" },
                take: 1,
              });
              if (variants.length === 0) {
                throw new Error(
                  `المخزون غير كافٍ لـ "${item.productName}"`
                );
              }
              await tx.sellerOfferVariant.update({
                where: { id: variants[0].id },
                data: { stock: { decrement: item.qty } },
              });
            }
            totalQty += item.qty;
          }

          // ─── 2. Find source product ───
          let srcProduct: any = offer.product;
          if (!srcProduct) {
            srcProduct = await tx.product.findFirst({
              where: { masterId: offer.masterId, deletedAt: null },
              include: {
                images: { orderBy: { order: "asc" } },
                variants: true,
              },
            });
          }
          if (!srcProduct) {
            throw new Error(`المنتج الأصلي غير موجود — عرض #${offerId}`);
          }

          // ─── 3. Create new Product in buyer's store ───
          const newSlug = await generateUniqueSlug(
            tx,
            buyerSellerId,
            srcProduct.slug
          );

          const newProduct = await tx.product.create({
            data: {
              sellerId: buyerSellerId,
              categoryId: srcProduct.categoryId,
              masterId: srcProduct.masterId,
              name: srcProduct.name,
              slug: newSlug,
              description: srcProduct.description,
              brand: srcProduct.brand,
              badge: srcProduct.badge,
              freeShipping: srcProduct.freeShipping,
              status: "ACTIVE",
              productType: srcProduct.productType,
              originCountry: srcProduct.originCountry,
              unit: srcProduct.unit,
              minOrderQty: 1,
              maxOrderQty: null,
            },
          });

          // ─── 4. Copy images ───
          for (const img of srcProduct.images) {
            await tx.productImage.create({
              data: {
                productId: newProduct.id,
                url: img.url,
                alt: img.alt,
                order: img.order,
                isMain: img.isMain,
              },
            });
          }

          // ─── 5. Compute qty per source variant ───
          const qtyByVariantId = new Map<number, number>();

          for (const item of items) {
            if (item.offerVariantId) {
              const ov = offer.variants.find(
                (v: any) => v.id === item.offerVariantId
              );
              const sv = srcProduct.variants.find(
                (v: any) =>
                  (ov?.sku && v.sku === ov.sku) ||
                  (ov?.barcode && v.barcode === ov.barcode)
              );
              if (sv) {
                qtyByVariantId.set(
                  sv.id,
                  (qtyByVariantId.get(sv.id) || 0) + item.qty
                );
              } else {
                const per = Math.ceil(
                  item.qty / Math.max(1, srcProduct.variants.length)
                );
                for (const v of srcProduct.variants) {
                  qtyByVariantId.set(
                    v.id,
                    (qtyByVariantId.get(v.id) || 0) + per
                  );
                }
              }
            } else {
              const per = Math.ceil(
                item.qty / Math.max(1, srcProduct.variants.length)
              );
              for (const v of srcProduct.variants) {
                qtyByVariantId.set(v.id, (qtyByVariantId.get(v.id) || 0) + per);
              }
            }
          }

          // ─── 6. Copy all variants + inventory ───
          for (const sv of srcProduct.variants) {
            const newSku = await generateUniqueSku(
              tx,
              buyerSellerId,
              sv.sku
            );
            const newBarcode = await resolveBarcode(
              tx,
              buyerSellerId,
              sv.barcode
            );

            const newVariant = await tx.productVariant.create({
              data: {
                productId: newProduct.id,
                sellerId: buyerSellerId,
                sku: newSku,
                price: sv.price,
                originalPrice: sv.originalPrice,
                discountPrice: sv.discountPrice,
                isDefault: sv.isDefault,
                isActive: true,
                optionsHash: `${sv.optionsHash}-${newProduct.id}`,
                barcode: newBarcode,
              },
            });

            await tx.inventory.create({
              data: {
                variantId: newVariant.id,
                quantity: qtyByVariantId.get(sv.id) || 0,
                reservedQuantity: 0,
                lowStockThreshold: 5,
              },
            });

            // ─── 7. Audit transfer ───
            if (qtyByVariantId.get(sv.id)) {
              const srcOfferVariant = offer.variants.find(
                (v: any) =>
                  (sv.sku && v.sku === sv.sku) ||
                  (sv.barcode && v.barcode === sv.barcode)
              );
              if (srcOfferVariant) {
                await tx.wholesaleStockTransfer.create({
                  data: {
                    offerVariantId: srcOfferVariant.id,
                    retailVariantId: newVariant.id,
                    qty: qtyByVariantId.get(sv.id)!,
                    type: "WHOLESALE_TO_BUYER",
                    notes: `طلب ${order.orderNumber}`,
                  },
                });
              }
            }
          }

          createdProductIds.push(newProduct.id);
          productsCreated++;
        }

        // ─── 8. Update order status ───
        await tx.wholesaleOrder.update({
          where: { id: orderId },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        });

        // ─── 9. Notify buyer ───
        await tx.notification.create({
          data: {
            userId: order.buyer.id,
            type: "ORDER_STATUS_CHANGED" as any,
            title: "✅ تم قبول طلب الجملة",
            message: `تم قبول طلبك ${order.orderNumber} من "${order.supplier.displayName}". المنتجات أُضيفت إلى متجرك.`,
            link: `/wholesale/orders/${order.id}`,
          },
        });

        return {
          orderId,
          orderNumber: order.orderNumber,
          buyerSellerId,
          productsCreated,
          totalQty,
          createdProductIds,
        };
      },
      { timeout: 60000, maxWait: 15000 }
    );
  },
};