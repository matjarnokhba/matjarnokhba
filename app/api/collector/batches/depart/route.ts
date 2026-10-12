import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { CollectionBatchService } from "@/services/collection-batch.service";
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

export async function POST(request: Request) {
  try {
    const auth = await requireCollector();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    // ═══ التحقق من وجود دفعة نشطة ═══
    const existing = await CollectionBatchService.getActiveBatchForCollector(
      auth.user.id
    );

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "لديك دفعة نشطة بالفعل — سلّمها للمستودع أولاً",
          activeBatchNumber: existing.batchNumber,
        },
        { status: 400 }
      );
    }

    // ═══ جلب كل الطلبات COLLECTED المُسندة للجامع ═══
    const items = await prisma.fulfillmentItem.findMany({
      where: {
        assignedCollectorId: auth.user.id,
        status: "COLLECTED",
      },
      select: { id: true },
    });

    if (items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "لا توجد طرود بانتظار التسليم — استلم من التجار أولاً",
        },
        { status: 400 }
      );
    }

    const fulfillmentItemIds = items.map((i) => i.id);

    // ═══ Transaction ═══
    const result = await prisma.$transaction(async (tx) => {
      // 1. إنشاء Batch
      const { batch, rawToken } = await CollectionBatchService.createBatch(
        tx,
        auth.user.id,
        fulfillmentItemIds
      );

      // 2. تحديث FulfillmentItems → IN_TRANSIT_TO_WAREHOUSE
      const now = new Date();
      for (const fi of items) {
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
            note: `انطلق مع دفعة ${batch.batchNumber}`,
          },
        });
      }

      // 3. إشعار WAREHOUSE_MANAGER
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
            title: "🚚 دفعة في الطريق",
            message: `${auth.user.name} في الطريق بـ${batch.itemsCount} طرد من ${batch.totalOrders} طلب`,
            link: `/warehouse`,
            category: "ORDER",
            severity: "INFO",
            metadata: {
              batchId: batch.id,
              batchNumber: batch.batchNumber,
              itemsCount: batch.itemsCount,
              totalOrders: batch.totalOrders,
            },
          },
        });
      }

      // 4. Audit
      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "COLLECTION_DEPART",
        entity: "CollectionBatch",
        entityId: String(batch.id),
        newData: {
          batchNumber: batch.batchNumber,
          itemsCount: batch.itemsCount,
          totalOrders: batch.totalOrders,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });

      return {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        itemsCount: batch.itemsCount,
        totalOrders: batch.totalOrders,
        rawToken,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Depart batch error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}