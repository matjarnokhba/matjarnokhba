import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET(
  _request: Request,
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

    const offer = await prisma.wholesaleOffer.findFirst({
      where: { id: offerId, deletedAt: null },
      include: {
        merchantProduct: {
          include: { master: { select: { id: true, name: true } }, variants: { orderBy: { id: "asc" } } },
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
      return NextResponse.json({ success: false, message: "العرض بلا منتج مقابل — لا يمكن النقل" }, { status: 400 });
    }
    if (["SUSPENDED", "ARCHIVED"].includes(offer.status)) {
      return NextResponse.json({ success: false, message: `لا يمكن النقل من عرض بحالة ${offer.status}` }, { status: 400 });
    }

    const loc = await prisma.inventoryLocation.findFirst({
      where: { businessUnitId: offer.businessUnitId, isActive: true },
      orderBy: { id: "asc" },
    });
    const wholesaleAcc = loc
      ? await prisma.inventoryAccount.findFirst({
          where: { locationId: loc.id, type: "WHOLESALE", isActive: true },
        })
      : null;

    const variantIds = offer.merchantProduct.variants.map((v) => v.id);
    const balances = wholesaleAcc
      ? await prisma.inventoryBalance.findMany({
          where: { merchantVariantId: { in: variantIds }, inventoryAccountId: wholesaleAcc.id },
        })
      : [];
    const balanceMap = new Map(balances.map((b) => [b.merchantVariantId, b.quantity]));

    const seller = await prisma.seller.findFirst({
      where: { userId: current.user.id, deletedAt: null },
      select: { id: true },
    });

    const variants = await Promise.all(
      offer.merchantProduct.variants.map(async (mv) => {
        const stock = balanceMap.get(mv.id) || 0;
        let retailExists = false;
        if (seller) {
          let ev = null;
          if (mv.barcode) {
            ev = await prisma.productVariant.findFirst({
              where: { barcode: mv.barcode, sellerId: seller.id, isActive: true },
              select: { id: true },
            });
          }
          if (!ev && mv.sku) {
            ev = await prisma.productVariant.findFirst({
              where: { sku: mv.sku, sellerId: seller.id, isActive: true },
              select: { id: true },
            });
          }
          retailExists = !!ev;
        }
        return {
          merchantVariantId: mv.id,
          sku: mv.sku,
          barcode: mv.barcode,
          baseUnitPrice: Number(mv.baseUnitPrice),
          displayAttributes: (mv.displayAttributes as any[]) || [],
          wholesaleStock: stock,
          retailExists,
        };
      })
    );

    return NextResponse.json({
      success: true,
      offer: { id: offer.id, status: offer.status, businessUnitId: offer.businessUnitId },
      merchantProduct: {
        id: offer.merchantProduct.id,
        name: offer.merchantProduct.displayName,
        masterName: offer.merchantProduct.master.name,
      },
      variants: variants.filter((v) => v.wholesaleStock > 0),
      hasSeller: !!seller,
    });
  } catch (error) {
    console.error("transfer-to-store prepare error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}