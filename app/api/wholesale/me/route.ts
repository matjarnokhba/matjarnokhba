import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    const supplier = await prisma.wholesaleSupplier.findUnique({
      where: { userId: current.user.id },
      include: {
        _count: {
          select: { sources: true, products: true, orders: true },
        },
      },
    });

    if (!supplier || supplier.deletedAt) {
      return NextResponse.json({ success: true, supplier: null });
    }

    return NextResponse.json({
      success: true,
      supplier: {
        id: supplier.id,
        displayName: supplier.displayName,
        slug: supplier.slug,
        activityType: supplier.activityType,
        description: supplier.description || "",
        city: supplier.city,
        region: supplier.region || "",
        logo: supplier.logo || "",
        isVerified: supplier.isVerified,
        status: supplier.status,
        counts: supplier._count,
        createdAt: supplier.createdAt,
      },
    });
  } catch (error) {
    console.error("Wholesale me error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}