import { NextResponse } from "next/server";
import { z } from "zod";
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

const schema = z.object({
  orderIds: z
    .array(z.number().int().positive())
    .min(1, "اختر طلبًا واحدًا على الأقل")
    .max(50, "الحد الأقصى 50 طلبًا في المرة"),
  collectorId: z.number().int().positive("اختر جامعًا"),
});

export async function POST(request: Request) {
  try {
    const auth = await requireWarehouse();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const { orderIds, collectorId } = parsed.data;

    const collector = await prisma.user.findUnique({
      where: { id: collectorId },
      select: { id: true, name: true, role: true, deletedAt: true },
    });

    if (!collector || collector.deletedAt || collector.role !== "COLLECTOR") {
      return NextResponse.json(
        { success: false, message: "الجامع غير صالح" },
        { status: 400 }
      );
    }

    const items = await prisma.fulfillmentItem.findMany({
      where: {
        orderItem: { orderId: { in: orderIds } },
        status: "READY_FOR_COLLECTION",
      },
      select: {
        id: true,
        assignedCollectorId: true,
        orderItem: { select: { orderId: true } },
      },
    });

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد عناصر قابلة للإسناد" },
        { status: 400 }
      );
    }

    const conflicts = items.filter(
      (i) =>
        i.assignedCollectorId !== null &&
        i.assignedCollectorId !== collectorId
    );

    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `${conflicts.length} عنصر مُسند لجامع آخر — ألغِ الإسناد أولاً`,
        },
        { status: 409 }
      );
    }

    const itemsToAssign = items.filter(
      (i) =>
        i.assignedCollectorId === null ||
        i.assignedCollectorId === collectorId
    );

    const uniqueOrderIds = Array.from(
      new Set(itemsToAssign.map((i) => i.orderItem.orderId))
    );

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.fulfillmentItem.updateMany({
        where: {
          id: { in: itemsToAssign.map((i) => i.id) },
        },
        data: {
          assignedCollectorId: collectorId,
          assignedAt: now,
          assignedById: auth.user.id,
        },
      });

      await tx.notification.create({
        data: {
          userId: collectorId,
          type: "ORDER_STATUS_CHANGED",
          title: `📋 ${uniqueOrderIds.length} مهمة جمع جديدة`,
          message: `تم إسنادك لجمع ${uniqueOrderIds.length} طرد`,
          link: `/collector`,
          category: "ORDER",
          severity: "INFO",
          metadata: {
            orderIds: uniqueOrderIds,
            assignedById: auth.user.id,
          },
        },
      });

      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "COLLECTION_ASSIGN",
        entity: "Order",
        entityId: orderIds.join(","),
        newData: {
          collectorId,
          collectorName: collector.name,
          orderIds: uniqueOrderIds,
          ordersCount: uniqueOrderIds.length,
          action: "bulk_assign",
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });
    });

    return NextResponse.json({
      success: true,
      collectorName: collector.name,
      assignedCount: uniqueOrderIds.length,
    });
  } catch (error) {
    console.error("Bulk assign error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}