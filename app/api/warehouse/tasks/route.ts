import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireWarehouse() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const allowed = ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }

  return { user: current.user };
}

export async function GET() {
  try {
    const auth = await requireWarehouse();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const items = await prisma.fulfillmentItem.findMany({
      where: {
        status: {
          in: [
            "IN_TRANSIT_TO_WAREHOUSE",
            "RECEIVED",
            "VERIFIED",
            "AVAILABLE_FOR_SHIPMENT",
          ],
        },
      },
      include: {
        seller: {
          select: { id: true, storeName: true, city: true },
        },
        orderItem: {
          select: {
            orderId: true,
            order: {
              select: { id: true, orderNumber: true },
            },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
      take: 500,
    });

    // ═══ تجميع حسب Order + الحالة الأدنى ═══
    const priority: Record<string, number> = {
      IN_TRANSIT_TO_WAREHOUSE: 0,
      RECEIVED: 1,
      VERIFIED: 2,
      AVAILABLE_FOR_SHIPMENT: 3,
    };

    const grouped = new Map<
      number,
      {
        orderId: number;
        orderNumber: string;
        seller: { id: number; storeName: string; city: string | null };
        itemsCount: number;
        status: string;
        readyAt: Date | null;
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
          status: item.status,
          readyAt: item.readyAt,
        });
      } else {
        existing.itemsCount += item.quantity;
        if (priority[item.status] < priority[existing.status]) {
          existing.status = item.status;
        }
      }
    }

    const all = Array.from(grouped.values());

    const incoming = all.filter(
      (t) => t.status === "IN_TRANSIT_TO_WAREHOUSE"
    );
    const received = all.filter((t) => t.status === "RECEIVED");
    const ready = all.filter(
      (t) =>
        t.status === "VERIFIED" || t.status === "AVAILABLE_FOR_SHIPMENT"
    );

    return NextResponse.json({
      success: true,
      incoming,
      received,
      ready,
    });
  } catch (error) {
    console.error("Warehouse tasks GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}