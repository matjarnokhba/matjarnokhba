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
              select: {
                id: true,
                status: true,
                assignedCollectorId: true,
              },
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

    // ═══ التحقق: هل الجامع مُسند لهذا الطلب؟ ═══
    const assignedToOther = allItems.some(
      (i) =>
        i.assignedCollectorId !== null &&
        i.assignedCollectorId !== auth.user.id
    );

    if (assignedToOther) {
      return NextResponse.json(
        {
          success: false,
          message: "هذا الطلب مُسند لجامع آخر",
        },
        { status: 403 }
      );
    }

    // ═══ idempotent: كل العناصر COLLECTED → مسح مكرر ═══
    const allCollected = allItems.every(
      (i) =>
        i.status === "COLLECTED" || i.status === "IN_TRANSIT_TO_WAREHOUSE"
    );

    if (allCollected) {
      return NextResponse.json({
        success: true,
        alreadyCollected: true,
        orderNumber: order.orderNumber,
        orderId: order.id,
      });
    }

    // ═══ تحقق: كل العناصر READY_FOR_COLLECTION ═══
    const notReady = allItems.filter(
      (i) => i.status !== "READY_FOR_COLLECTION"
    );

    if (notReady.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "بعض العناصر لم تكن جاهزة للاستلام — تأكد مع التاجر أولاً",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      // ═══ 1. كل FulfillmentItems: READY → COLLECTED ═══
      for (const fi of allItems) {
        await tx.fulfillmentItem.update({
          where: { id: fi.id },
          data: {
            status: "COLLECTED",
            collectedAt: now,
            collectedById: auth.user.id,
          },
        });

        await tx.fulfillmentStatusHistory.create({
          data: {
            fulfillmentItemId: fi.id,
            fromStatus: "READY_FOR_COLLECTION",
            toStatus: "COLLECTED",
            changedById: auth.user.id,
            note: "استلمه مسؤول الجمع من التاجر",
          },
        });
      }

      // ═══ 2. Audit ═══
      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "COLLECTION_PICKUP",
        entity: "Order",
        entityId: String(order.id),
        oldData: { fulfillmentStatus: "READY_FOR_COLLECTION" },
        newData: {
          fulfillmentStatus: "COLLECTED",
          itemsCount: allItems.length,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });

      // ═══ 3. إشعار التاجر ═══
      if (order.sellerId) {
        const seller = await tx.seller.findUnique({
          where: { id: order.sellerId },
          select: { userId: true },
        });
        if (seller) {
          await tx.notification.create({
            data: {
              userId: seller.userId,
              type: "ORDER_STATUS_CHANGED",
              title: "🚚 تم استلام الطرد",
              message: `مسؤول الجمع استلم الطرد ${order.orderNumber}`,
              link: `/seller/orders/${order.id}`,
              category: "ORDER",
              severity: "INFO",
            },
          });
        }
      }

      // ═══ 4. إشعار WAREHOUSE_MANAGER ═══
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
            title: "📦 طرد بالطريق",
            message: `الطلب ${order.orderNumber} تم استلامه من التاجر — في الطريق إلى المستودع`,
            link: `/warehouse`,
            category: "ORDER",
            severity: "INFO",
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      alreadyCollected: false,
      orderNumber: order.orderNumber,
      orderId: order.id,
    });
  } catch (error) {
    console.error("Collector collect error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}