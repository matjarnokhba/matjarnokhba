import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    const where: Record<string, unknown> = { deletedAt: null };
    if (status && ["PENDING", "ACTIVE", "SUSPENDED", "CLOSED"].includes(status)) {
      where.status = status;
    }

    const suppliers = await prisma.wholesaleSupplier.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        _count: { select: { sources: true, products: true, orders: true } },
      },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      suppliers: suppliers.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        slug: s.slug,
        activityType: s.activityType,
        description: s.description,
        city: s.city,
        region: s.region,
        logo: s.logo,
        isVerified: s.isVerified,
        status: s.status,
        createdAt: s.createdAt,
        user: s.user,
        counts: s._count,
      })),
    });
  } catch (error) {
    console.error("Admin wholesale suppliers error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}