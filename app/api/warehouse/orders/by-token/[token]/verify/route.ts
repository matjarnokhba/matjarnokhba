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

    // ═══ idempotent ═══
    const allVerified = allItems.every((i) =>
      ["VERIFIED", "AVAILABLE_FOR_SHIPMENT"].includes(i.status)
    );

    if (allVerified) {
      return NextResponse.json({
        success: true,
        alreadyVerified: true,
        orderNumber: order.orderNumber,
        orderId: order.id,
      });
    }

    // ═══ تحقق: كل العناصر RECEIVED ═══
    const notReceived = allItems.filter((i) => i.status !== "RECEIVED");

    if (notReceived.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "بعض العناصر لم تُستلم بعد — استلم أولاً",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      for (const fi of allItems) {
        // ═══ 1. FulfillmentItem: RECEIVED → VERIFIED ═══
        await tx.fulfillmentItem.update({
          where: { id: fi.id },
          data: {
            status: "VERIFIED",
            verifiedAt: now,
            verifiedById: auth.user.id,
          },
        });

        await tx.fulfillmentStatusHistory.create({
          data: {
            fulfillmentItemId: fi.id,
            fromStatus: "RECEIVED",
            toStatus: "VERIFIED",
            changedById: auth.user.id,
            note: "تم فحص المنتج وتأكيد حالته",
          },
        });

        // ═══ 2. WarehouseReceipt → VERIFIED ═══
        await tx.warehouseReceipt.updateMany({
          where: {
            fulfillmentItemId: fi.id,
            status: "RECEIVED",
          },
          data: {
            status: "VERIFIED",
            verifiedAt: now,
            verifiedById: auth.user.id,
          },
        });
      }

      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "WAREHOUSE_VERIFY",
        entity: "Order",
        entityId: String(order.id),
        oldData: { fulfillmentStatus: "RECEIVED" },
        newData: {
          fulfillmentStatus: "VERIFIED",
          itemsCount: allItems.length,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });
    });

    return NextResponse.json({
      success: true,
      alreadyVerified: false,
      orderNumber: order.orderNumber,
      orderId: order.id,
    });
  } catch (error) {
    console.error("Warehouse verify error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}