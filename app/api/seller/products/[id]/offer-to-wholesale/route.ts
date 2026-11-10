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
  transferQuantities: z.array(
    z.object({
      variantId: z.number().int().positive(),
      quantity: z.number().int().min(1),
    })
  ).min(1),
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
    const { businessUnitId, wholesalePrice, minOrderQty, maxOrderQty, transferQuantities } = parsed.data;

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

    // 1. Check inventory and find any existing masterId
    let masterId: number | null = null;
    for (const t of transferQuantities) {
      const rv = product.variants.find((v) => v.id === t.variantId);
      if (!rv) {
        return NextResponse.json({ success: false, message: `الخيار ${t.variantId} غير موجود` }, { status: 400 });
      }
      if ((rv.inventory?.quantity ?? 0) < t.quantity) {
        return NextResponse.json(
          { success: false, message: `المخزون المتاح للتجزئة (${rv.inventory?.quantity ?? 0}) أقل من الكمية (${t.quantity})` },
          { status: 400 }
        );
      }

      if (!masterId) {
        let mv: any = null;
        if (rv.barcode) mv = await prisma.masterVariant.findFirst({ where: { barcode: rv.barcode } });
        if (!mv && rv.sku) mv = await prisma.masterVariant.findFirst({ where: { sku: rv.sku } });
        if (mv) masterId = mv.masterId;
      }
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

    // 3. Map quantities to the master variants
    const matched: Array<{ retailVariantId: number; masterVariantId: number; masterId: number; quantity: number }> = [];
    for (const t of transferQuantities) {
      const rv = product.variants.find((v) => v.id === t.variantId)!;
      
      let mv: any = null;
      if (rv.barcode) mv = await prisma.masterVariant.findFirst({ where: { barcode: rv.barcode } });
      if (!mv && rv.sku) mv = await prisma.masterVariant.findFirst({ where: { sku: rv.sku } });
      
      if (!mv) {
        return NextResponse.json(
          { success: false, message: `الخيار "${rv.sku || rv.id}" لا يطابق أي منتج أصلي — حدث خطأ غير متوقع.` },
          { status: 500 }
        );
      }
      matched.push({ retailVariantId: rv.id, masterVariantId: mv.id, masterId: mv.masterId, quantity: t.quantity });
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

    // Ensure InventoryLocation + WHOLESALE account
    let loc = await prisma.inventoryLocation.findFirst({
      where: { businessUnitId, isActive: true },
      orderBy: { id: "asc" },
    });
    if (!loc) {
      loc = await prisma.inventoryLocation.create({
        data: { businessUnitId, name: "الموقع الافتراضي", type: "SHOP_FLOOR", isActive: true },
      });
    }
    let wholesaleAcc = await prisma.inventoryAccount.findFirst({
      where: { locationId: loc.id, type: "WHOLESALE", isActive: true },
    });
    if (!wholesaleAcc) {
      wholesaleAcc = await prisma.inventoryAccount.create({
        data: { locationId: loc.id, businessUnitId, type: "WHOLESALE", isActive: true },
      });
    }

    // Get MerchantProduct that M6.2 just created
    const mp = await prisma.merchantProduct.findFirst({
      where: { businessUnitId, masterId, deletedAt: null },
      include: { variants: { select: { id: true, masterVariantId: true } } },
    });
    if (!mp) {
      return NextResponse.json({ success: false, message: "خطأ داخلي: MerchantProduct لم يُنشأ" }, { status: 500 });
    }

    // Transfer stock (retail → wholesale)
    for (const m of matched) {
      const mv = mp.variants.find((v) => v.masterVariantId === m.masterVariantId);
      if (!mv) continue;

      await prisma.inventory.updateMany({
        where: { variantId: m.retailVariantId },
        data: { quantity: { decrement: m.quantity } },
      });

      await prisma.inventoryBalance.upsert({
        where: {
          merchantVariantId_inventoryAccountId: {
            merchantVariantId: mv.id,
            inventoryAccountId: wholesaleAcc.id,
          },
        },
        create: {
          merchantVariantId: mv.id,
          inventoryAccountId: wholesaleAcc.id,
          quantity: m.quantity,
        },
        update: { quantity: { increment: m.quantity } },
      });

      await prisma.inventoryLedger.create({
        data: {
          merchantVariantId: mv.id,
          inventoryAccountId: wholesaleAcc.id,
          businessUnitId,
          type: "ADJUSTMENT",
          quantity: m.quantity,
          referenceType: "OFFER_FROM_RETAIL",
          referenceId: offerId,
          createdByUserId: current.user.id,
        },
      });
    }

    if (reactivated) {
      await prisma.wholesaleOffer.update({
        where: { id: offerId },
        data: { status: "ACTIVE" },
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
        transferredQuantities: matched.map((m) => ({
          masterVariantId: m.masterVariantId,
          quantity: m.quantity,
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