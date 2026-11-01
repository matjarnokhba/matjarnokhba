import { prisma } from "@/lib/prisma";
import { recordLineage } from "@/lib/lineage";

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\u0600-\u06FF-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 80) || "product"
  );
}

async function ensureUniqueProductSlug(tx: any, sellerId: number, base: string): Promise<string> {
  let slug = base;
  let counter = 1;
  while (await tx.product.findFirst({ where: { sellerId, slug } })) {
    slug = `${base}-${counter++}`;
    if (counter > 100) throw new Error("تعذر إنشاء رابط فريد");
  }
  return slug;
}

async function ensureUniqueSku(tx: any, sellerId: number, base: string): Promise<string> {
  const cleanBase = (base || `SKU-${Date.now()}`).trim().substring(0, 50);
  let sku = cleanBase;
  let counter = 1;
  while (await tx.productVariant.findFirst({ where: { sellerId, sku } })) {
    sku = `${cleanBase}-${counter++}`;
    if (counter > 100) throw new Error("تعذر إنشاء SKU فريد");
  }
  return sku;
}

async function resolveBarcode(tx: any, sellerId: number, base: string | null): Promise<string | null> {
  if (!base) return null;
  let barcode = base;
  let counter = 1;
  while (await tx.productVariant.findFirst({ where: { sellerId, barcode } })) {
    if (counter > 5) return null;
    barcode = `${base}-${counter++}`;
  }
  return barcode;
}

export type ImportParams = {
  businessId: number;
  masterVariantId: number;
  quantity: number;
  retailPrice: number;
};

export const RetailImportService = {
  async importToRetail(params: ImportParams) {
    return prisma.$transaction(async (tx) => {
      const biz = await tx.business.findUnique({
        where: { id: params.businessId },
        include: {
          linkedSeller: {
            select: { id: true, userId: true, isVerified: true, storeName: true },
          },
        },
      });
      if (!biz || biz.deletedAt) throw new Error("النشاط غير موجود");
      if (biz.type !== "WHOLESALE_TRADER") {
        throw new Error("الاستيراد للتجزئة متاح فقط لحسابات تجار الجملة");
      }
      if (biz.status !== "VERIFIED") throw new Error("النشاط غير موثق");
      if (!biz.linkedSellerId || !biz.linkedSeller) {
        throw new Error("لا يوجد متجر تجزئة مربوط بهذا النشاط");
      }
      if (biz.linkedSeller.userId !== biz.ownerUserId) {
        throw new Error("متجر التجزئة لا ينتمي لمالك النشاط");
      }
      if (!biz.linkedSeller.isVerified) {
        throw new Error("متجر التجزئة غير موثق");
      }
      if (params.quantity <= 0) throw new Error("الكمية يجب أن تكون أكبر من صفر");
      if (params.retailPrice <= 0) throw new Error("سعر التجزئة يجب أن يكون موجبًا");

      const wholesaleInv = await tx.wholesaleInventory.findUnique({
        where: {
          businessId_masterVariantId: {
            businessId: params.businessId,
            masterVariantId: params.masterVariantId,
          },
        },
        include: { master: true, masterVariant: true },
      });
      if (!wholesaleInv) throw new Error("لا يوجد مخزون جملة لهذا المتغير");
      if (wholesaleInv.quantity < params.quantity) {
        throw new Error(`المخزون المتاح ${wholesaleInv.quantity} فقط`);
      }

      const sellerId = biz.linkedSellerId;
      const master = wholesaleInv.master;
      const mv = wholesaleInv.masterVariant;

      // Find or create retail Product in linked seller (matched by masterId)
      let product = await tx.product.findFirst({
        where: { sellerId, masterId: master.id, deletedAt: null },
        include: { variants: true },
      });

      let productCreated = false;
      if (!product) {
        const slug = await ensureUniqueProductSlug(tx, sellerId, master.slug);
        product = await tx.product.create({
          data: {
            sellerId,
            categoryId: master.categoryId,
            masterId: master.id,
            name: master.name,
            slug,
            description: master.description,
            brand: master.brand,
            status: "ACTIVE",
          },
          include: { variants: true },
        });
        for (let i = 0; i < master.images.length; i++) {
          await tx.productImage.create({
            data: {
              productId: product.id,
              url: master.images[i],
              alt: master.name,
              order: i,
              isMain: i === 0,
            },
          });
        }
        productCreated = true;
      }

      // Find or create variant by optionsHash
      let variant = product.variants.find((v: any) => v.optionsHash === mv.optionsHash);
      let variantCreated = false;
      if (!variant) {
        const sku = await ensureUniqueSku(tx, sellerId, mv.sku || `SKU-${mv.id}`);
        const barcode = await resolveBarcode(tx, sellerId, mv.barcode);
        variant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sellerId,
            sku,
            barcode,
            price: params.retailPrice,
            isDefault: product.variants.length === 0,
            isActive: true,
            optionsHash: mv.optionsHash,
          },
        });
        await tx.inventory.create({
          data: { variantId: variant.id, quantity: 0, lowStockThreshold: 5 },
        });
        variantCreated = true;
      } else {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { price: params.retailPrice },
        });
      }

      await tx.inventory.update({
        where: { variantId: variant.id },
        data: { quantity: { increment: params.quantity } },
      });

      await tx.wholesaleInventory.update({
        where: {
          businessId_masterVariantId: {
            businessId: params.businessId,
            masterVariantId: params.masterVariantId,
          },
        },
        data: { quantity: { decrement: params.quantity } },
      });

      await recordLineage(tx, {
        masterId: master.id,
        masterVariantId: mv.id,
        fromBusinessId: params.businessId,
        toBusinessId: params.businessId,
        quantity: params.quantity,
        unitPrice: String(wholesaleInv.lastUnitCost),
        transferType: "RETAIL_IMPORT",
        notes: `تحويل داخلي: business#${params.businessId} → seller#${sellerId} (variant#${variant.id})`,
      });

      return {
        productId: product.id,
        variantId: variant.id,
        productSlug: product.slug,
        quantity: params.quantity,
        productCreated,
        variantCreated,
        retailPrice: params.retailPrice,
      };
    }, { timeout: 30000 });
  },
};