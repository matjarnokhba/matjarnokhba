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
            "READY_FOR_COLLECTION",
            "COLLECTED",
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

    const priority: Record<string, number> = {
      READY_FOR_COLLECTION: 0,
      COLLECTED: 1,
      IN_TRANSIT_TO_WAREHOUSE: 2,
      RECEIVED: 3,
      VERIFIED: 4,
      AVAILABLE_FOR_SHIPMENT: 5,
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
        assignedCollectorId: number | null;
        assignedAt: Date | null;
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
          assignedCollectorId: item.assignedCollectorId,
          assignedAt: item.assignedAt,
        });
      } else {
        existing.itemsCount += item.quantity;
        if (priority[item.status] < priority[existing.status]) {
          existing.status = item.status;
        }
      }
    }

    const all = Array.from(grouped.values());

    const readyForCollection = all.filter(
      (t) => t.status === "READY_FOR_COLLECTION"
    );
    const assigned = all.filter(
      (t) =>
        t.status === "COLLECTED" || t.status === "IN_TRANSIT_TO_WAREHOUSE"
    );
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
      readyForCollection,
      assigned,
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