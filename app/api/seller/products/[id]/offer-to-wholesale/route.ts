import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
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
        variants: {
          select: {
            id: true,
            sku: true,
            barcode: true,
            inventory: { select: { quantity: true } },
          },
        },
      },
    });
    if (!product || product.deletedAt || product.sellerId !== current.user.seller.id) {
      return NextResponse.json({ success: false, message: "المنتج غير موجود" }, { status: 404 });
    }

    // Match all transferQuantities to master variants
    const matched: Array<{ retailVariantId: number; masterVariantId: number; masterId: number; quantity: number }> = [];
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

      let mv: { id: number; masterId: number } | null = null;
      if (rv.barcode) {
        mv = await prisma.masterVariant.findFirst({ where: { barcode: rv.barcode }, select: { id: true, masterId: true } });
      }
      if (!mv && rv.sku) {
        mv = await prisma.masterVariant.findFirst({ where: { sku: rv.sku }, select: { id: true, masterId: true } });
      }
      if (!mv) {
        return NextResponse.json(
          { success: false, message: `الخيار "${rv.sku || rv.id}" لا يطابق أي منتج أصلي — أضف الباركود أو سجل الهوية أولًا` },
          { status: 400 }
        );
      }
      matched.push({ retailVariantId: rv.id, masterVariantId: mv.id, masterId: mv.masterId, quantity: t.quantity });
    }

    const uniqueMasterIds = Array.from(new Set(matched.map((m) => m.masterId)));
    if (uniqueMasterIds.length !== 1) {
      return NextResponse.json(
        { success: false, message: "الخيارات المحددة تنتمي لمنتجات أصلية مختلفة — يجب أن تكون كلها من نفس الهوية" },
        { status: 400 }
      );
    }
    const masterId = uniqueMasterIds[0];

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

    let offerId: number;
    try {
      offerId = await WholesaleOfferService.create(current.user.id, businessUnitId, {
        masterId,
        wholesalePrice,
        minOrderQty,
        maxOrderQty: maxOrderQty ?? null,
        claimType: "RESELLER",
        variants: variantsForOffer,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "فشل إنشاء العرض";
      return NextResponse.json({ success: false, message: msg }, { status: 400 });
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

    return NextResponse.json({ success: true, offerId, masterId });
  } catch (error) {
    console.error("Offer-to-wholesale error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}