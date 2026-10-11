import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { AuditService } from "@/services/audit.service";

async function requireWarehouse() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const allowed = ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"];
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
    const auth = await requireWarehouse();
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
              select: { id: true, status: true, quantity: true },
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
        { success: false, message: "لا توجد عناصر" },
        { status: 400 }
      );
    }

    // ═══ idempotent ═══
    const allReceived = allItems.every((i) =>
      ["RECEIVED", "VERIFIED", "AVAILABLE_FOR_SHIPMENT"].includes(i.status)
    );

    if (allReceived) {
      return NextResponse.json({
        success: true,
        alreadyReceived: true,
        orderNumber: order.orderNumber,
        orderId: order.id,
      });
    }

    // ═══ تحقق: كل العناصر IN_TRANSIT ═══
    const notReady = allItems.filter(
      (i) => i.status !== "IN_TRANSIT_TO_WAREHOUSE"
    );

    if (notReady.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "بعض العناصر لم تُستلم من التاجر بعد — تواصل مع الجامع",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      // ═══ 1. FulfillmentItem: IN_TRANSIT → RECEIVED ═══
      for (const fi of allItems) {
        await tx.fulfillmentItem.update({
          where: { id: fi.id },
          data: {
            status: "RECEIVED",
            warehouseReceivedAt: now,
            warehouseReceivedById: auth.user.id,
          },
        });

        await tx.fulfillmentStatusHistory.create({
          data: {
            fulfillmentItemId: fi.id,
            fromStatus: "IN_TRANSIT_TO_WAREHOUSE",
            toStatus: "RECEIVED",
            changedById: auth.user.id,
            note: "استُلم في المستودع",
          },
        });

        // ═══ 2. WarehouseReceipt ═══
        const receiptNumber = `WR-${Date.now()}-${fi.id}`;
        await tx.warehouseReceipt.create({
          data: {
            receiptNumber,
            fulfillmentItemId: fi.id,
            quantity: fi.quantity,
            status: "RECEIVED",
            receivedById: auth.user.id,
          },
        });
      }

      // ═══ 3. Audit ═══
      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "WAREHOUSE_RECEIVE",
        entity: "Order",
        entityId: String(order.id),
        oldData: { fulfillmentStatus: "IN_TRANSIT_TO_WAREHOUSE" },
        newData: {
          fulfillmentStatus: "RECEIVED",
          itemsCount: allItems.length,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });

      // ═══ 4. إشعار التاجر ═══
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
              title: "📥 وصل الطرد للمستودع",
              message: `الطلب ${order.orderNumber} وصل إلى المستودع`,
              link: `/seller/orders/${order.id}`,
              category: "ORDER",
              severity: "INFO",
            },
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      alreadyReceived: false,
      orderNumber: order.orderNumber,
      orderId: order.id,
    });
  } catch (error) {
    console.error("Warehouse receive error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}