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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "ALL";
    const search = searchParams.get("q")?.trim() || "";

    const where: any = { deletedAt: null };
    if (status !== "ALL") where.status = status;
    if (search) {
      where.OR = [
        { storeName: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const sellers = await prisma.seller.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        _count: {
          select: {
            products: { where: { deletedAt: null } },
            orders: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // إحصائيات
    const stats = await prisma.seller.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: true,
    });
    const statsMap: any = {
      PENDING: 0,
      ACTIVE: 0,
      SUSPENDED: 0,
      CLOSED: 0,
      total: 0,
    };
    for (const s of stats) {
      statsMap[s.status] = s._count;
      statsMap.total += s._count;
    }

    return NextResponse.json({ success: true, sellers, stats: statsMap });
  } catch (error) {
    console.error("Admin sellers GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}