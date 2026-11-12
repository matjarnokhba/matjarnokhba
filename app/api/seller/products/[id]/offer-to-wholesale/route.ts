import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { logWholesaleAction } from "@/lib/wholesale/audit";
import { WholesaleOfferService } from "@/services/wholesale-offer.service";
import {
  getBusinessUnitContext,
  assertBusinessUnitCapability,
} from "@/lib/wholesale/context";

const schema = z.object({
  businessUnitId: z.number().int().positive(),
  wholesalePrice: z.number().positive(),
  minOrderQty: z.number().int().min(1),
  maxOrderQty: z.number().int().min(1).nullable().optional(),
  inventoryMode: z.enum(["SHARED", "SPLIT"]),
  variantSplits: z.array(
    z.object({
      variantId: z.number().int().positive(),
      retailQty: z.number().int().min(0),
    })
  ).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current?.user?.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
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
    const { businessUnitId, wholesalePrice, minOrderQty, maxOrderQty, inventoryMode, variantSplits } = parsed.data;

    const ctx = await getBusinessUnitContext(current.user.id, businessUnitId);
    assertBusinessUnitCapability(ctx, "WHOLESALE_SELL");

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: { orderBy: { order: "asc" } },
        category: true,
        variants: {
          select: {
            id: true,
            sku: true,
            barcode: true,
            isDefault: true,
            inventory: { select: { quantity: true } },
            optionValues: {
              select: {
                optionValue: {
                  select: {
                    value: true,
                    option: { select: { name: true, order: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!product || product.deletedAt || product.sellerId !== current.user.seller.id) {
      return NextResponse.json({ success: false, message: "المنتج غير موجود" }, { status: 404 });
    }

    // 1. Build variants list + validate (M13.1a)
    type VariantProcess = { retailVariantId: number; retailQty: number; originalQty: number };
    const variantsToProcess: VariantProcess[] = [];
    
    if (inventoryMode === "SHARED") {
      for (const pv of product.variants) {
        variantsToProcess.push({
          retailVariantId: pv.id,
          retailQty: 0,
          originalQty: pv.inventory?.quantity ?? 0,
        });
      }
    } else {
      if (!variantSplits || variantSplits.length === 0) {
        return NextResponse.json(
          { success: false, message: "في وضع SPLIT يجب تحديد كمية التجزئة لكل خيار" },
          { status: 400 }
        );
      }
      for (const split of variantSplits) {
        const rv = product.variants.find((v) => v.id === split.variantId);
        if (!rv) {
          return NextResponse.json(
            { success: false, message: `الخيار ${split.variantId} غير موجود` },
            { status: 400 }
          );
        }
        const originalQty = rv.inventory?.quantity ?? 0;
        if (split.retailQty > originalQty) {
          return NextResponse.json(
            { success: false, message: `الكمية المطلوبة للتجزئة (${split.retailQty}) تتجاوز المتاح (${originalQty})` },
            { status: 400 }
          );
        }
        variantsToProcess.push({
          retailVariantId: rv.id,
          retailQty: split.retailQty,
          originalQty,
        });
      }
    }
    
    let masterId: number | null = null;
    for (const vp of variantsToProcess) {
      const rv = product.variants.find((v) => v.id === vp.retailVariantId);
      if (!rv) continue;
      let mv: any = null;
      if (rv.barcode) mv = await prisma.masterVariant.findFirst({ where: { barcode: rv.barcode } });
      if (!mv && rv.sku) mv = await prisma.masterVariant.findFirst({ where: { sku: rv.sku } });
      if (mv) { masterId = mv.masterId; break; }
    }

    // 2. Auto-create MasterProduct & variants if none found
    if (!masterId) {
      const catSlug = (product.category?.name || "general").toLowerCase().replace(/[^\w\s\u0600-\u06FF-]/g, "").replace(/\s+/g, "-").substring(0, 70) || "general";
      let masterCat = await prisma.masterCategory.findFirst({ where: { slug: catSlug } });
      if (!masterCat) {
        masterCat = await prisma.masterCategory.create({
          data: { name: product.category?.name || "عام", slug: catSlug, isLeaf: true, isActive: true }
        });
      }

      const newMaster = await prisma.masterProduct.create({
        data: {
          name: product.name,
          description: product.description,
          brand: product.brand,
          categoryId: masterCat.id,
          images: product.images.map((i) => i.url),
          status: "ACTIVE",
          approvedAt: new Date(),
          createdByUserId: current.user.id,
        }
      });
      masterId = newMaster.id;

      for (const rv of product.variants) {
        const attrs = (rv.optionValues || []).map((ov: any) => ({
          name: ov.optionValue.option.name,
          value: ov.optionValue.value,
          order: ov.optionValue.option.order,
        })).sort((a: any, b: any) => a.order - b.order);

        const hash = crypto.createHash("sha256").update(JSON.stringify(attrs)).digest("hex");

        await prisma.masterVariant.create({
          data: {
            masterId: newMaster.id,
            sku: rv.sku,
            barcode: rv.barcode,
            attributes: attrs,
            attributesHash: hash,
            isDefault: rv.isDefault,
          }
        });
      }
    }

    // 3. Map retail → master variants
    const matched: Array<{
      retailVariantId: number;
      masterVariantId: number;
      masterId: number;
      retailQty: number;
      originalQty: number;
    }> = [];
    for (const vp of variantsToProcess) {
      const rv = product.variants.find((v) => v.id === vp.retailVariantId)!;
      let mv: any = null;
      if (rv.barcode) mv = await prisma.masterVariant.findFirst({ where: { barcode: rv.barcode } });
      if (!mv && rv.sku) mv = await prisma.masterVariant.findFirst({ where: { sku: rv.sku } });
      if (!mv) {
        return NextResponse.json(
          { success: false, message: `الخيار "${rv.sku || rv.id}" لا يطابق أي منتج أصلي.` },
          { status: 500 }
        );
      }
      matched.push({
        retailVariantId: rv.id,
        masterVariantId: mv.id,
        masterId: mv.masterId,
        retailQty: vp.retailQty,
        originalQty: vp.originalQty,
      });
    }

    // Create offer (M6.2 auto-creates MerchantProduct)
    const variantsForOffer: Array<{ masterVariantId: number; tiers: Array<{ minQty: number; maxQty: number | null; unitPrice: number }> }> = [];
    for (const m of matched) {
      if (!variantsForOffer.find((v) => v.masterVariantId === m.masterVariantId)) {
        variantsForOffer.push({
          masterVariantId: m.masterVariantId,
          tiers: [{ minQty: minOrderQty, maxQty: maxOrderQty ?? null, unitPrice: wholesalePrice }],
        });
      }
    }

    // M7.2: Check for existing offer — auto-resume if OUT_OF_STOCK
    const existingOffer = await prisma.wholesaleOffer.findFirst({
      where: { businessUnitId, masterId, deletedAt: null },
      select: { id: true, status: true, merchantProductId: true },
    });

    let offerId: number;
    let reactivated = false;

    if (existingOffer) {
      if (existingOffer.status !== "OUT_OF_STOCK") {
        return NextResponse.json(
          {
            success: false,
            message: `يوجد عرض سابق بحالة "${existingOffer.status}". أرشفه أو انتظر المراجعة قبل إنشاء عرض جديد.`,
            existingOfferId: existingOffer.id,
          },
          { status: 409 }
        );
      }
      if (!existingOffer.merchantProductId) {
        return NextResponse.json(
          { success: false, message: "العرض السابق بلا منتج مقابل — أرشفه وأنشئ عرضًا جديدًا." },
          { status: 400 }
        );
      }

      const existingVariants = await prisma.wholesaleOfferVariant.findMany({
        where: { offerId: existingOffer.id },
        select: { masterVariantId: true },
      });
      const existingMVIds = new Set(existingVariants.map((v) => v.masterVariantId));
      const missing = matched.filter((m) => !existingMVIds.has(m.masterVariantId));
      if (missing.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `العرض السابق لا يحتوي على كل الخيارات المحددة (مفقود: ${missing.length} خيار). أرشفه وأنشئ عرضًا جديدًا.`,
          },
          { status: 400 }
        );
      }

      offerId = existingOffer.id;
      reactivated = true;
    } else {
      try {
        offerId = await WholesaleOfferService.create(current.user.id, businessUnitId, {
          masterId,
          wholesalePrice,
          minOrderQty,
          maxOrderQty: maxOrderQty ?? null,
          claimType: "RESELLER",
          skipReview: true,
          variants: variantsForOffer,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "فشل إنشاء العرض";
        return NextResponse.json({ success: false, message: msg }, { status: 400 });
      }
    }

    // M13.1a: Pool-based inventory
    const mp = await prisma.merchantProduct.findFirst({
      where: { businessUnitId, masterId, deletedAt: null },
      select: { id: true },
    });
    if (!mp) {
      return NextResponse.json({ success: false, message: "خطأ داخلي: MerchantProduct لم يُنشأ" }, { status: 500 });
    }
    
    await prisma.$transaction(async (tx) => {
      let pool = await tx.inventoryPool.findUnique({
        where: { businessUnitId_masterId: { businessUnitId, masterId } },
        include: { variants: true },
      });
      
      if (!pool) {
        const mvs = await tx.masterVariant.findMany({ where: { masterId }, select: { id: true } });
        pool = await tx.inventoryPool.create({
          data: {
            businessUnitId,
            masterId,
            mode: "SPLIT",
            variants: {
              create: mvs.map((mv) => ({ masterVariantId: mv.id, quantity: 0, reservedQuantity: 0 })),
            },
          },
          include: { variants: true },
        });
      }
      
      await tx.merchantProduct.update({ where: { id: mp.id }, data: { poolId: pool.id } });
      
      for (const m of matched) {
        const poolVar = pool.variants.find((p) => p.masterVariantId === m.masterVariantId);
        if (!poolVar) continue;
        
        if (inventoryMode === "SHARED") {
          const merged = poolVar.quantity + m.originalQty;
          await tx.inventoryPoolVariant.update({ where: { id: poolVar.id }, data: { quantity: merged } });
          await tx.inventory.updateMany({ where: { variantId: m.retailVariantId }, data: { quantity: merged } });
        } else {
          const wholesaleQty = m.originalQty - m.retailQty;
          await tx.inventory.updateMany({ where: { variantId: m.retailVariantId }, data: { quantity: m.retailQty } });
          await tx.inventoryPoolVariant.update({ where: { id: poolVar.id }, data: { quantity: { increment: wholesaleQty } } });
        }
      }
      
      if (inventoryMode === "SHARED") {
        await tx.product.update({ where: { id: productId }, data: { poolId: pool.id } });
      } else {
        await tx.product.update({ where: { id: productId }, data: { poolId: null } });
      }
      
      await tx.inventoryPool.update({ where: { id: pool.id }, data: { mode: inventoryMode } });
    }, { timeout: 30000, maxWait: 10000 });
if (reactivated) {
      // M10.10c: reactivated offers auto-verified + active
      await prisma.wholesaleOffer.update({
        where: { id: offerId },
        data: {
          status: "ACTIVE",
          claimVerified: true,
          reviewLevel: "AUTO",
          approvedAt: new Date(),
        },
      });
    }

    await logWholesaleAction(null, {
      userId: current.user.id,
      businessUnitId,
      action: reactivated
        ? "wholesale_offer.reactivated_from_retail"
        : "wholesale_offer.created_from_retail",
      entityType: "WholesaleOffer",
      entityId: offerId,
      after: {
        masterId,
        wholesalePrice,
        minOrderQty,
        maxOrderQty,
        variantsCount: variantsForOffer.length,
        inventoryMode,
        perVariant: matched.map((m) => ({
          masterVariantId: m.masterVariantId,
          retailQty: m.retailQty,
          originalQty: m.originalQty,
        })),
      },
    });

    return NextResponse.json({ success: true, offerId, masterId, reactivated });
  } catch (error) {
    console.error("Offer-to-wholesale error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}