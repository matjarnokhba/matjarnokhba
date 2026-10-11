import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { AuditService } from "@/services/audit.service";

async function requireCollector() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const allowed = ["COLLECTOR", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }

  return { user: current.user };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const auth = await requireCollector();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { token } = await params;
    if (!token || token.length < 20) {
      return NextResponse.json(
        { success: false, message: "رمز غير صحيح" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findFirst({
      where: { deliveryToken: token },
      include: {
        items: {
          select: {
            id: true,
            fulfillmentItems: {
              select: { id: true, status: true },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      );
    }

    const allItems = order.items.flatMap((i) => i.fulfillmentItems);

    if (allItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد عناصر تجهيز" },
        { status: 400 }
      );
    }

    // ═══ idempotent: كل العناصر IN_TRANSIT → مسح مكرر ═══
    const allInTransit = allItems.every(
      (i) => i.status === "IN_TRANSIT_TO_WAREHOUSE"
    );

    if (allInTransit) {
      return NextResponse.json({
        success: true,
        alreadyInTransit: true,
        orderNumber: order.orderNumber,
        orderId: order.id,
      });
    }

    // ═══ تحقق: كل العناصر COLLECTED ═══
    const notCollected = allItems.filter(
      (i) => i.status !== "COLLECTED"
    );

    if (notCollected.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "بعض العناصر لم تُستلم بعد — استلم من التاجر أولاً",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      // ═══ 1. كل FulfillmentItems: COLLECTED → IN_TRANSIT_TO_WAREHOUSE ═══
      for (const fi of allItems) {
        await tx.fulfillmentItem.update({
          where: { id: fi.id },
          data: {
            status: "IN_TRANSIT_TO_WAREHOUSE",
            departedAt: now,
          },
        });

        await tx.fulfillmentStatusHistory.create({
          data: {
            fulfillmentItemId: fi.id,
            fromStatus: "COLLECTED",
            toStatus: "IN_TRANSIT_TO_WAREHOUSE",
            changedById: auth.user.id,
            note: "في الطريق إلى المستودع",
          },
        });
      }

      // ═══ 2. Audit ═══
      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "COLLECTION_DEPART",
        entity: "Order",
        entityId: String(order.id),
        oldData: { fulfillmentStatus: "COLLECTED" },
        newData: {
          fulfillmentStatus: "IN_TRANSIT_TO_WAREHOUSE",
          itemsCount: allItems.length,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });

      // ═══ 3. إشعار WAREHOUSE_MANAGER ═══
      const warehouseManagers = await tx.user.findMany({
        where: {
          role: { in: ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"] },
          deletedAt: null,
        },
        select: { id: true },
      });
      for (const wm of warehouseManagers) {
        await tx.notification.create({
          data: {
            userId: wm.id,
            type: "ORDER_STATUS_CHANGED",
            title: "🚚 طرد في الطريق",
            message: `الطلب ${order.orderNumber} انطلق نحو المستودع`,
            link: `/warehouse`,
            category: "ORDER",
            severity: "INFO",
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      alreadyInTransit: false,
      orderNumber: order.orderNumber,
      orderId: order.id,
    });
  } catch (error) {
    console.error("Collector arrive error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}