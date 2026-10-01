import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireSeller() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };
  return { user: current.user, seller: current.user.seller };
}

export async function GET(request: Request) {
  try {
    const auth = await requireSeller();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "ALL";
    const search = searchParams.get("q")?.trim() || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    const where: any = { userId: auth.user.id };
    if (filter === "UNREAD") where.isRead = false;
    if (filter === "READ") where.isRead = true;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { message: { contains: search, mode: "insensitive" } },
      ];
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: auth.user.id, isRead: false },
      }),
    ]);

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Seller notifications GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}