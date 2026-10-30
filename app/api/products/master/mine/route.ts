import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    const supplier = current.user.wholesaleSupplier;
    if (!supplier) {
      return NextResponse.json(
        { success: false, message: "ليس لديك حساب جملة" },
        { status: 403 }
      );
    }

    const masters = await prisma.productMaster.findMany({
      where: {
        createdByUserId: current.user.id,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { id: true, name: true } },
        _count: {
          select: {
            variants: true,
            offers: { where: { deletedAt: null } },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      masters: masters.map((m) => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        brand: m.brand,
        barcode: m.barcode,
        images: m.images,
        isVerified: m.isVerified,
        status: m.status,
        category: m.category,
        variantCount: m._count.variants,
        offerCount: m._count.offers,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("My masters error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}