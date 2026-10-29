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
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    // Buyer must be verified Seller (decision S3=a)
    if (!current.user.seller) {
      return NextResponse.json(
        { success: false, message: "عرض العروض متاح للتجار فقط" },
        { status: 403 }
      );
    }

    if (current.user.seller.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "متجرك غير نشط" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const masterId = parseInt(id);
    if (isNaN(masterId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const master = await prisma.productMaster.findUnique({
      where: { id: masterId, deletedAt: null },
      select: { id: true, name: true, barcode: true },
    });
    if (!master) {
      return NextResponse.json(
        { success: false, message: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    const offers = await prisma.sellerOffer.findMany({
      where: {
        masterId,
        isActive: true,
        deletedAt: null,
        supplier: { status: "ACTIVE", deletedAt: null },
      },
      orderBy: [{ wholesalePrice: "asc" }, { minOrderQty: "asc" }],
      include: {
        supplier: {
          select: {
            id: true,
            displayName: true,
            slug: true,
            isVerified: true,
            activityType: true,
            city: true,
            region: true,
          },
        },
        source: {
          select: { id: true, name: true, city: true, address: true },
        },
        variants: {
          select: {
            id: true,
            stock: true,
            sku: true,
            barcode: true,
            options: true,
            masterVariantId: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      master,
      offers: offers.map((o) => ({
        id: o.id,
        offerType: o.offerType,
        wholesalePrice: Number(o.wholesalePrice),
        retailPrice: o.retailPrice ? Number(o.retailPrice) : null,
        minOrderQty: o.minOrderQty,
        maxOrderQty: o.maxOrderQty,
        unit: o.unit,
        claimType: o.claimType,
        claimVerified: o.claimVerified,
        notes: o.notes,
        supplier: o.supplier,
        source: o.source,
        variants: o.variants.map((v) => ({
          id: v.id,
          stock: v.stock,
          sku: v.sku,
          barcode: v.barcode,
          options: v.options,
          masterVariantId: v.masterVariantId,
        })),
        totalStock: o.variants.reduce((s, v) => s + v.stock, 0),
      })),
    });
  } catch (error) {
    console.error("Master offers error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}