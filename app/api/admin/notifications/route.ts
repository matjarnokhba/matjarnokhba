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
    const category = searchParams.get("category") || "ALL";
    const severity = searchParams.get("severity") || "ALL";
    const filter = searchParams.get("filter") || "ALL"; // ALL | UNREAD | READ
    const search = searchParams.get("q")?.trim() || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    const where: any = {
      userId: auth.user.id,
    };

    if (category !== "ALL") where.category = category;
    if (severity !== "ALL") where.severity = severity;
    if (filter === "UNREAD") where.isRead = false;
    if (filter === "READ") where.isRead = true;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { message: { contains: search, mode: "insensitive" } },
      ];
    }

    const [notifications, unreadCount, categoryCounts] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: auth.user.id, isRead: false },
      }),
      prisma.notification.groupBy({
        by: ["category"],
        where: { userId: auth.user.id },
        _count: true,
      }),
    ]);

    const counts: any = { PRODUCT: 0, SELLER: 0, ORDER: 0, SYSTEM: 0 };
    for (const c of categoryCounts) {
      if (c.category) counts[c.category] = c._count;
    }

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
      categoryCounts: counts,
    });
  } catch (error) {
    console.error("Admin notifications GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}