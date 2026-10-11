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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireWarehouse();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
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
        { success: false, message: "لا توجد عناصر" },
        { status: 400 }
      );
    }

    const firstAssigned = allItems.find(
      (i) => i.assignedCollectorId !== null
    );

    if (!firstAssigned) {
      return NextResponse.json(
        { success: false, message: "الطلب غير مُسند لأي جامع" },
        { status: 400 }
      );
    }

    const previousCollectorId = firstAssigned.assignedCollectorId!;

    const alreadyCollected = allItems.some(
      (i) =>
        i.status === "COLLECTED" ||
        i.status === "IN_TRANSIT_TO_WAREHOUSE" ||
        i.status === "RECEIVED" ||
        i.status === "VERIFIED" ||
        i.status === "AVAILABLE_FOR_SHIPMENT"
    );

    if (alreadyCollected) {
      return NextResponse.json(
        {
          success: false,
          message: "لا يمكن التراجع — الجامع استلم الطرد بالفعل",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.fulfillmentItem.updateMany({
        where: {
          orderItem: { orderId },
          status: "READY_FOR_COLLECTION",
        },
        data: {
          assignedCollectorId: null,
          assignedAt: null,
          assignedById: null,
        },
      });

      await tx.notification.create({
        data: {
          userId: previousCollectorId,
          type: "ORDER_STATUS_CHANGED",
          title: "❌ تم إلغاء مهمة جمع",
          message: `تم إلغاء إسناد الطلب ${order.orderNumber} منك`,
          link: `/collector`,
          category: "ORDER",
          severity: "WARNING",
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            cancelledBy: auth.user.id,
          },
        },
      });

      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "COLLECTION_ASSIGN",
        entity: "Order",
        entityId: String(orderId),
        oldData: {
          assignedCollectorId: previousCollectorId,
        },
        newData: {
          assignedCollectorId: null,
          action: "unassign",
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });
    });

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    console.error("Unassign collector error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}