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

    const hasSeller = !!current.user.seller;
    const hasSupplier = !!current.user.wholesaleSupplier;
    if (!hasSeller && !hasSupplier) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
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
      where: { id: masterId },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        manufacturer: { select: { id: true, name: true } },
        variants: {
          orderBy: { id: "asc" },
          select: { id: true, barcode: true, sku: true, options: true },
        },
        derivativesFrom: {
          select: {
            id: true,
            childMasterId: true,
            differences: true,
            createdAt: true,
            childMaster: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!master || master.deletedAt) {
      return NextResponse.json(
        { success: false, message: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      master: {
        id: master.id,
        name: master.name,
        slug: master.slug,
        brand: master.brand,
        description: master.description,
        images: master.images,
        barcode: master.barcode,
        qrCode: master.qrCode,
        specifications: master.specifications,
        category: master.category,
        manufacturer: master.manufacturer,
        isVerified: master.isVerified,
        status: master.status,
        variants: master.variants,
        derivatives: master.derivativesFrom.map((d) => ({
          id: d.id,
          childMasterId: d.childMasterId,
          childName: d.childMaster.name,
          childSlug: d.childMaster.slug,
          differences: d.differences,
          createdAt: d.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Master detail error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}