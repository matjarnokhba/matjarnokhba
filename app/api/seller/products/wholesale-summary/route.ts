import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current?.user?.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const sellerId = current.user.seller.id;

    const products = await prisma.product.findMany({
      where: { sellerId, deletedAt: null },
      select: {
        id: true,
        variants: { select: { id: true, barcode: true, sku: true } },
      },
    });

    const barcodes = new Set<string>();
    const skus = new Set<string>();
    for (const p of products) {
      for (const v of p.variants) {
        if (v.barcode) barcodes.add(v.barcode);
        if (v.sku) skus.add(v.sku);
      }
    }
    if (barcodes.size === 0 && skus.size === 0) {
      return NextResponse.json({ success: true, summary: {} });
    }

    const masterVariants = await prisma.masterVariant.findMany({
      where: {
        OR: [
          barcodes.size > 0 ? { barcode: { in: Array.from(barcodes) } } : undefined,
          skus.size > 0 ? { sku: { in: Array.from(skus) } } : undefined,
        ].filter(Boolean) as any,
      },
      select: { id: true, barcode: true, sku: true, masterId: true },
    });

    const barcodeToMaster = new Map<string, { masterVariantId: number; masterId: number }>();
    const skuToMaster = new Map<string, { masterVariantId: number; masterId: number }>();
    for (const mv of masterVariants) {
      if (mv.barcode) barcodeToMaster.set(mv.barcode, { masterVariantId: mv.id, masterId: mv.masterId });
      if (mv.sku) skuToMaster.set(mv.sku, { masterVariantId: mv.id, masterId: mv.masterId });
    }

    const owner = await prisma.businessOwner.findUnique({
      where: { userId: current.user.id },
      select: { id: true },
    });
    if (!owner) return NextResponse.json({ success: true, summary: {} });

    const bus = await prisma.businessUnit.findMany({
      where: { ownerId: owner.id, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    if (bus.length === 0) return NextResponse.json({ success: true, summary: {} });
    const buIds = bus.map((b) => b.id);

    const allMasterIds = new Set<number>();
    for (const p of products) {
      for (const v of p.variants) {
        const match = (v.barcode && barcodeToMaster.get(v.barcode)) || (v.sku && skuToMaster.get(v.sku));
        if (match) allMasterIds.add(match.masterId);
      }
    }
    if (allMasterIds.size === 0) {
      return NextResponse.json({ success: true, summary: {} });
    }

    const merchantProducts = await prisma.merchantProduct.findMany({
      where: { businessUnitId: { in: buIds }, masterId: { in: Array.from(allMasterIds) }, deletedAt: null },
      select: {
        id: true,
        masterId: true,
        businessUnitId: true,
        variants: { select: { id: true, barcode: true, sku: true } },
        wholesaleOffers: {
          where: { deletedAt: null },
          select: { id: true, status: true },
          orderBy: { id: "desc" },
          take: 1,
        },
      },
    });
    if (merchantProducts.length === 0) {
      return NextResponse.json({ success: true, summary: {} });
    }

    const locations = await prisma.inventoryLocation.findMany({
      where: { businessUnitId: { in: buIds }, isActive: true },
      select: { id: true },
    });
    const accounts = locations.length > 0
      ? await prisma.inventoryAccount.findMany({
          where: { locationId: { in: locations.map((l) => l.id) }, type: "WHOLESALE", isActive: true },
          select: { id: true },
        })
      : [];
    const accountIds = accounts.map((a) => a.id);

    const allMpVariantIds = merchantProducts.flatMap((mp) => mp.variants.map((v) => v.id));
    const balances = accountIds.length > 0 && allMpVariantIds.length > 0
      ? await prisma.inventoryBalance.findMany({
          where: { merchantVariantId: { in: allMpVariantIds }, inventoryAccountId: { in: accountIds } },
          select: { merchantVariantId: true, quantity: true },
        })
      : [];
    const stockByMpVariant = new Map<number, number>();
    for (const b of balances) {
      stockByMpVariant.set(b.merchantVariantId, (stockByMpVariant.get(b.merchantVariantId) || 0) + b.quantity);
    }

    const mpByMasterId = new Map<number, typeof merchantProducts[number]>();
    for (const mp of merchantProducts) {
      if (!mpByMasterId.has(mp.masterId)) mpByMasterId.set(mp.masterId, mp);
    }

    const summary: Record<number, { wholesaleStock: number; offerId: number | null; offerStatus: string | null }> = {};

    for (const product of products) {
      let totalStock = 0;
      let offer: { id: number; status: string } | null = null;

      for (const v of product.variants) {
        const match = (v.barcode && barcodeToMaster.get(v.barcode)) || (v.sku && skuToMaster.get(v.sku));
        if (!match) continue;

        const mp = mpByMasterId.get(match.masterId);
        if (!mp) continue;

        for (const mpv of mp.variants) {
          if ((mpv.barcode && mpv.barcode === v.barcode) || (mpv.sku && mpv.sku === v.sku)) {
            totalStock += stockByMpVariant.get(mpv.id) || 0;
          }
        }
        if (!offer && mp.wholesaleOffers.length > 0) offer = mp.wholesaleOffers[0];
      }

      if (totalStock > 0 || offer) {
        summary[product.id] = {
          wholesaleStock: totalStock,
          offerId: offer?.id ?? null,
          offerStatus: offer?.status ?? null,
        };
      }
    }

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("wholesale-summary error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}