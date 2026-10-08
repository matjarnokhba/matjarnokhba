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
    const status = searchParams.get("status") || "ALL";
    const source = searchParams.get("source") || "ALL";
    const search = searchParams.get("q")?.trim() || "";

    const where: any = { sellerId: auth.seller.id };

    if (status !== "ALL") where.status = status;
    if (source !== "ALL") where.source = source;

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const [orders, stats] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: { take: 3 },
          user: { select: { name: true, email: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: { sellerId: auth.seller.id },
        _count: true,
      }),
    ]);

    const statsMap: any = {
      NEW: 0,
      PROCESSING: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
      RETURNED: 0,
      total: 0,
    };
    for (const s of stats) {
      statsMap[s.status] = s._count;
      statsMap.total += s._count;
    }

    const formatted = orders.map((o) => {
      const customer = o.customerSnapshot as any;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        source: o.source,
        total: Number(o.total),
        createdAt: o.createdAt,
        itemsCount: o._count.items,
        customerName: customer?.name || o.user.name,
        customerPhone: customer?.phone || null,
        customerCity: customer?.city || null,
        items: o.items.map((i) => ({
          productName: i.productName,
          imageUrl: i.imageUrl,
          quantity: i.quantity,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      orders: formatted,
      stats: statsMap,
    });
  } catch (error) {
    console.error("Seller orders GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}