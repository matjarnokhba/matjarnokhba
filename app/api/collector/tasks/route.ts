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

    // ═══ 1. جلب FulfillmentItems بحالة READY أو COLLECTED أو IN_TRANSIT ═══
    const items = await prisma.fulfillmentItem.findMany({
      where: {
        // ═══ فقط المهام المُسندة لهذا الجامع ═══
        assignedCollectorId: auth.user.id,
        status: {
          in: ["READY_FOR_COLLECTION", "COLLECTED"],
        },
      },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            city: true,
          },
        },
        orderItem: {
          select: {
            orderId: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
              },
            },
          },
        },
      },
      orderBy: [{ readyAt: "asc" }, { createdAt: "asc" }],
      take: 300,
    });

    // ═══ 2. تجميع حسب Order ═══
    const grouped = new Map<
      number,
      {
        orderId: number;
        orderNumber: string;
        seller: { id: number; storeName: string; city: string | null };
        itemsCount: number;
        status: "READY_FOR_COLLECTION" | "COLLECTED" | "IN_TRANSIT_TO_WAREHOUSE";
        readyAt: Date | null;
        collectedAt: Date | null;
      }
    >();

    for (const item of items) {
      const order = item.orderItem.order;
      const key = order.id;

      // ═══ تحديد الحالة الأدنى (الأولوية للـREADY) ═══
      const priority: Record<string, number> = {
        READY_FOR_COLLECTION: 0,
        COLLECTED: 1,
        IN_TRANSIT_TO_WAREHOUSE: 2,
      };

      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          seller: {
            id: item.seller.id,
            storeName: item.seller.storeName,
            city: item.seller.city,
          },
          itemsCount: item.quantity,
          status: item.status as any,
          readyAt: item.readyAt,
          collectedAt: item.collectedAt,
        });
      } else {
        existing.itemsCount += item.quantity;

        // لو هذا العنصر حالته أدنى → نُحدّث الحالة المشتركة
        if (priority[item.status] < priority[existing.status]) {
          existing.status = item.status as any;
          if (item.readyAt && (!existing.readyAt || item.readyAt < existing.readyAt)) {
            existing.readyAt = item.readyAt;
          }
          if (
            item.collectedAt &&
            (!existing.collectedAt || item.collectedAt < existing.collectedAt)
          ) {
            existing.collectedAt = item.collectedAt;
          }
        }
      }
    }

    const tasks = Array.from(grouped.values());

    return NextResponse.json({ success: true, tasks });
  } catch (error) {
    console.error("Collector tasks GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}