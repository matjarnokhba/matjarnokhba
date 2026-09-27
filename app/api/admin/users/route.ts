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
    const roleFilter = searchParams.get("role") || "ALL";
    const search = searchParams.get("q")?.trim() || "";

    const where: any = { deletedAt: null };
    if (roleFilter !== "ALL") where.role = roleFilter;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // إحصائيات
    const stats = await prisma.user.groupBy({
      by: ["role"],
      where: { deletedAt: null },
      _count: true,
    });

    const statsMap: any = { CUSTOMER: 0, ADMIN: 0, SUPER_ADMIN: 0, total: 0 };
    for (const s of stats) {
      statsMap[s.role] = s._count;
      statsMap.total += s._count;
    }

    return NextResponse.json({ success: true, users, stats: statsMap });
  } catch (error) {
    console.error("Admin users GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}