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
    const batchId = parseInt(id);
    if (isNaN(batchId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const batch = await prisma.collectionBatch.findUnique({
      where: { id: batchId },
      include: {
        items: {
          include: {
            fulfillmentItem: {
              select: {
                id: true,
                status: true,
                quantity: true,
              },
            },
          },
        },
      },
    });

    if (!batch) {
      return NextResponse.json(
        { success: false, message: "الدفعة غير موجودة" },
        { status: 404 }
      );
    }

    if (batch.status === "DELIVERED") {
      return NextResponse.json({
        success: true,
        alreadyReceived: true,
        itemsReceived: batch.itemsCount,
        batchNumber: batch.batchNumber,
      });
    }

    if (batch.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, message: "الدفعة ملغاة" },
        { status: 400 }
      );
    }

    const notInTransit = batch.items.filter(
      (bi) => bi.fulfillmentItem.status !== "IN_TRANSIT_TO_WAREHOUSE"
    );

    if (notInTransit.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `${notInTransit.length} عنصر ليس في الطريق — تحقق من الحالة`,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      for (const bi of batch.items) {
        await tx.fulfillmentItem.update({
          where: { id: bi.fulfillmentItem.id },
          data: {
            status: "RECEIVED",
            warehouseReceivedAt: now,
            warehouseReceivedById: auth.user.id,
          },
        });

        await tx.fulfillmentStatusHistory.create({
          data: {
            fulfillmentItemId: bi.fulfillmentItem.id,
            fromStatus: "IN_TRANSIT_TO_WAREHOUSE",
            toStatus: "RECEIVED",
            changedById: auth.user.id,
            note: `استُلم عبر الدفعة ${batch.batchNumber}`,
          },
        });

        const receiptNumber = `WR-${Date.now()}-${bi.fulfillmentItem.id}`;
        await tx.warehouseReceipt.create({
          data: {
            receiptNumber,
            fulfillmentItemId: bi.fulfillmentItem.id,
            quantity: bi.fulfillmentItem.quantity,
            status: "RECEIVED",
            receivedById: auth.user.id,
          },
        });
      }

      await tx.collectionBatch.update({
        where: { id: batchId },
        data: {
          status: "DELIVERED",
          receivedAt: now,
          receivedById: auth.user.id,
          qrTokenRevokedAt: now,
        },
      });

      await tx.notification.create({
        data: {
          userId: batch.collectorId,
          type: "ORDER_STATUS_CHANGED",
          title: "✅ تم إكمال مهمتك",
          message: `تم استلام دفعتك ${batch.batchNumber} (${batch.itemsCount} طرد) في المستودع`,
          link: `/collector`,
          category: "ORDER",
          severity: "INFO",
          metadata: {
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            itemsCount: batch.itemsCount,
          },
        },
      });

      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "WAREHOUSE_RECEIVE",
        entity: "CollectionBatch",
        entityId: String(batchId),
        oldData: { status: "IN_TRANSIT" },
        newData: {
          status: "DELIVERED",
          batchNumber: batch.batchNumber,
          itemsCount: batch.itemsCount,
          collectorId: batch.collectorId,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });
    });

    return NextResponse.json({
      success: true,
      alreadyReceived: false,
      itemsReceived: batch.itemsCount,
      batchNumber: batch.batchNumber,
    });
  } catch (error) {
    console.error("Receive batch error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}