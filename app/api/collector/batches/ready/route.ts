import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireCollector() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const allowed = ["COLLECTOR", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }

  return { user: current.user };
}

export async function GET() {
  try {
    const auth = await requireCollector();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const items = await prisma.fulfillmentItem.findMany({
      where: {
        assignedCollectorId: auth.user.id,
        status: "COLLECTED",
      },
      include: {
        seller: { select: { id: true, storeName: true, city: true } },
        orderItem: {
          select: {
            orderId: true,
            order: { select: { id: true, orderNumber: true } },
          },
        },
      },
      orderBy: { collectedAt: "asc" },
    });

    // ═══ تجميع حسب Order ═══
    const grouped = new Map<
      number,
      {
        orderId: number;
        orderNumber: string;
        seller: { id: number; storeName: string; city: string | null };
        itemsCount: number;
        collectedAt: Date | null;
      }
    >();

    for (const item of items) {
      const order = item.orderItem.order;
      const existing = grouped.get(order.id);

      if (!existing) {
        grouped.set(order.id, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          seller: {
            id: item.seller.id,
            storeName: item.seller.storeName,
            city: item.seller.city,
          },
          itemsCount: item.quantity,
          collectedAt: item.collectedAt,
        });
      } else {
        existing.itemsCount += item.quantity;
      }
    }

    return NextResponse.json({
      success: true,
      readyOrders: Array.from(grouped.values()),
      totalItems: items.length,
    });
  } catch (error) {
    console.error("Ready batch error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}