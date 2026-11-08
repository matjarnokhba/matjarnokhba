import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  transfers: z
    .array(
      z.object({
        merchantVariantId: z.number().int().positive(),
        quantity: z.number().int().min(1),
      })
    )
    .min(1),
});

async function uniqueSku(tx: any, sellerId: number, base: string): Promise<string> {
  const clean = (base || "").trim().substring(0, 50) || `SKU-${Date.now()}`;
  let attempt = 0;
  let sku = clean;
  // Search across ALL variants of this seller (not just product) to respect @@unique([sellerId, sku])
  while (await tx.productVariant.findFirst({ where: { sellerId, sku } })) {
    sku = `${clean.substring(0, 45)}-${++attempt}`;
    if (attempt > 100) return `SKU-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }
  return sku;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\u0600-\u06FF-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 70) || "product"
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const offerId = parseInt(id);
    if (isNaN(offerId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const seller = await prisma.seller.findFirst({
      where: { userId: current.user.id, deletedAt: null },
      select: { id: true },
    });
    if (!seller) {
      return NextResponse.json(
        { success: false, message: "لا يوجد متجر تجزئة مرتبط بحسابك" },
        { status: 400 }
      );
    }

    const offer = await prisma.wholesaleOffer.findFirst({
      where: { id: offerId, deletedAt: null },
      include: {
        merchantProduct: {
          include: { master: { select: { id: true, name: true, brand: true, categoryId: true } }, variants: true },
        },
        businessUnit: {
          select: {
            id: true,
            owner: { select: { userId: true } },
            members: { where: { userId: current.user.id, isActive: true, deletedAt: null }, select: { id: true } },
          },
        },
      },
    });
    if (!offer) return NextResponse.json({ success: false, message: "العرض غير موجود" }, { status: 404 });

    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(current.user.role);
    const isOwner = offer.businessUnit.owner.userId === current.user.id;
    const isMember = offer.businessUnit.members.length > 0;
    if (!isAdmin && !isOwner && !isMember) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    if (!offer.merchantProduct) {
      return NextResponse.json({ success: false, message: "العرض بلا منتج مقابل" }, { status: 400 });
    }
    if (["SUSPENDED", "ARCHIVED"].includes(offer.status)) {
      return NextResponse.json({ success: false, message: `لا يمكن النقل من عرض بحالة ${offer.status}` }, { status: 400 });
    }

    const mp = offer.merchantProduct;
    const mvMap = new Map(mp.variants.map((v) => [v.id, v]));

    const result = await prisma.$transaction(
      async (tx) => {
        let loc = await tx.inventoryLocation.findFirst({
          where: { businessUnitId: offer.businessUnitId, isActive: true },
          orderBy: { id: "asc" },
        });
        if (!loc) {
          loc = await tx.inventoryLocation.create({
            data: { businessUnitId: offer.businessUnitId, name: "الموقع الافتراضي", type: "SHOP_FLOOR", isActive: true },
          });
        }
        let wholesaleAcc = await tx.inventoryAccount.findFirst({
          where: { locationId: loc.id, type: "WHOLESALE", isActive: true },
        });
        if (!wholesaleAcc) {
          wholesaleAcc = await tx.inventoryAccount.create({
            data: { locationId: loc.id, businessUnitId: offer.businessUnitId, type: "WHOLESALE", isActive: true },
          });
        }

        let targetProduct = null as any;
        for (const t of parsed.data.transfers) {
          const mv = mvMap.get(t.merchantVariantId);
          if (!mv) continue;
          let ev = null;
          if (mv.barcode) {
            ev = await tx.productVariant.findFirst({
              where: { barcode: mv.barcode, sellerId: seller.id, isActive: true },
              include: { product: true },
            });
          }
          if (!ev && mv.sku) {
            ev = await tx.productVariant.findFirst({
              where: { sku: mv.sku, sellerId: seller.id, isActive: true },
              include: { product: true },
            });
          }
          if (ev) {
            targetProduct = ev.product;
            break;
          }
        }

        if (!targetProduct) {
          const baseSlug = slugify(mp.displayName);
          const slug = `${baseSlug}-${crypto.randomUUID().substring(0, 8)}`;
          targetProduct = await tx.product.create({
            data: {
              sellerId: seller.id,
              categoryId: mp.master.categoryId,
              name: mp.displayName,
              slug,
              description: mp.displayDescription,
              brand: mp.master.brand,
              status: "DRAFT",
              salePrice: Number(mp.retailPrice),
            },
          });

          const imgs = (mp.displayImages as string[]) || [];
          for (let i = 0; i < imgs.length; i++) {
            await tx.productImage.create({
              data: { productId: targetProduct.id, url: imgs[i], alt: mp.displayName, order: i, isMain: i === 0 },
            });
          }

          for (const v of mp.variants) {
            const vSku = await uniqueSku(tx, seller.id, v.sku || `MV-${v.id}`);
            const newPv = await tx.productVariant.create({
              data: {
                productId: targetProduct.id,
                sellerId: seller.id,
                sku: vSku,
                barcode: v.barcode,
                price: Number(v.baseUnitPrice),
                isDefault: v.isDefault,
                isActive: true,
                optionsHash: `mv-${v.id}-${targetProduct.id}`,
              },
            });
            await tx.inventory.create({
              data: { variantId: newPv.id, quantity: 0, reservedQuantity: 0, lowStockThreshold: 5 },
            });
          }
        }

        let movedCount = 0;
        let totalQty = 0;

        for (const t of parsed.data.transfers) {
          const mv = mvMap.get(t.merchantVariantId);
          if (!mv) continue;

          const balance = await tx.inventoryBalance.findFirst({
            where: { merchantVariantId: mv.id, inventoryAccountId: wholesaleAcc.id },
          });
          if (!balance || balance.quantity < t.quantity) {
            throw new Error(`المخزون الجملة غير كافٍ للخيار "${mv.sku || mv.id}"`);
          }

          let pv = null;
          if (mv.barcode) {
            // First: does it exist in the same product?
            pv = await tx.productVariant.findFirst({
              where: { barcode: mv.barcode, productId: targetProduct.id, isActive: true },
            });
            // If not: check if barcode collides with a different product of this seller
            if (!pv) {
              const collision = await tx.productVariant.findFirst({
                where: { barcode: mv.barcode, sellerId: seller.id, isActive: true },
              });
              if (collision) {
                throw new Error(`الباركود "${mv.barcode}" مسجل بالفعل في منتج آخر — لا يمكن النقل. أزل الباركود أو غيّره.`);
              }
            }
          }
          if (!pv && mv.sku) {
            pv = await tx.productVariant.findFirst({
              where: { sku: mv.sku, productId: targetProduct.id, isActive: true },
            });
          }
          if (!pv) {
            const vSku = await uniqueSku(tx, seller.id, mv.sku || `MV-${mv.id}-${targetProduct.id}`);
            pv = await tx.productVariant.create({
              data: {
                productId: targetProduct.id,
                sellerId: seller.id,
                sku: vSku,
                barcode: mv.barcode,
                price: Number(mv.baseUnitPrice),
                isDefault: false,
                isActive: true,
                optionsHash: `mv-${mv.id}-${targetProduct.id}`,
              },
            });
            await tx.inventory.create({
              data: { variantId: pv.id, quantity: 0, reservedQuantity: 0, lowStockThreshold: 5 },
            });
          }

          const inc = await tx.inventory.updateMany({
            where: { variantId: pv.id },
            data: { quantity: { increment: t.quantity } },
          });
          if (inc.count === 0) {
            await tx.inventory.create({
              data: { variantId: pv.id, quantity: t.quantity, reservedQuantity: 0, lowStockThreshold: 5 },
            });
          }

          const dec = await tx.inventoryBalance.updateMany({
            where: { id: balance.id, quantity: { gte: t.quantity } },
            data: { quantity: { decrement: t.quantity } },
          });
          if (dec.count === 0) throw new Error("تعذر تحديث مخزون الجملة (تعارض)");

          await tx.inventoryLedger.create({
            data: {
              merchantVariantId: mv.id,
              inventoryAccountId: wholesaleAcc.id,
              businessUnitId: offer.businessUnitId,
              type: "ADJUSTMENT",
              quantity: t.quantity,
              referenceType: "TRANSFER_TO_STORE",
              referenceId: offer.id,
              createdByUserId: current.user.id,
            },
          });

          movedCount++;
          totalQty += t.quantity;
        }

        const remaining = await tx.inventoryBalance.aggregate({
          where: {
            merchantVariantId: { in: mp.variants.map((v) => v.id) },
            inventoryAccountId: wholesaleAcc.id,
          },
          _sum: { quantity: true },
        });
        const remainingQty = remaining._sum.quantity || 0;
        let newStatus = offer.status;
        if (remainingQty === 0 && offer.status === "ACTIVE") {
          await tx.wholesaleOffer.update({ where: { id: offer.id }, data: { status: "PAUSED" } });
          newStatus = "PAUSED";
        }

        return { productId: targetProduct.id, movedCount, totalQty, newStatus, remainingQty };
      },
      { timeout: 30000 }
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("transfer-to-store error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}