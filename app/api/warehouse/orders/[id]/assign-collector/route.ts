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
  collectorId: z.number().int().positive("اختر جامعًا"),
});

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

    const { collectorId } = parsed.data;

    // ═══ تحقق: هل المستخدم جامع نشط؟ ═══
    const collector = await prisma.user.findUnique({
      where: { id: collectorId },
      select: {
        id: true,
        name: true,
        role: true,
        deletedAt: true,
      },
    });

    if (!collector || collector.deletedAt) {
      return NextResponse.json(
        { success: false, message: "الجامع غير موجود" },
        { status: 404 }
      );
    }

    if (collector.role !== "COLLECTOR") {
      return NextResponse.json(
        { success: false, message: "المستخدم ليس جامعًا" },
        { status: 400 }
      );
    }

    // ═══ جلب عناصر الطلب ═══
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: {
            id: true,
            fulfillmentItems: {
              select: { id: true, status: true, assignedCollectorId: true },
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

    // ═══ التحقق: كل العناصر READY_FOR_COLLECTION ═══
    const notReady = allItems.filter(
      (i) => i.status !== "READY_FOR_COLLECTION"
    );

    if (notReady.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "لا يمكن الإسناد — بعض العناصر لم تجهز بعد من التاجر",
        },
        { status: 400 }
      );
    }

    // ═══ التحقق: هل مُسند بالفعل لشخص آخر؟ ═══
    const alreadyAssigned = allItems.some(
      (i) =>
        i.assignedCollectorId !== null &&
        i.assignedCollectorId !== collectorId
    );

    if (alreadyAssigned) {
      return NextResponse.json(
        {
          success: false,
          message: "هذا الطلب مُسند بالفعل لجامع آخر",
        },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      // ═══ تحديث كل العناصر ═══
      await tx.fulfillmentItem.updateMany({
        where: {
          orderItem: { orderId },
          status: "READY_FOR_COLLECTION",
        },
        data: {
          assignedCollectorId: collectorId,
          assignedAt: now,
          assignedById: auth.user.id,
        },
      });

      // ═══ إشعار الجامع ═══
      await tx.notification.create({
        data: {
          userId: collectorId,
          type: "ORDER_STATUS_CHANGED",
          title: "📋 مهمة جمع جديدة",
          message: `تم إسنادك لجمع الطلب ${order.orderNumber}`,
          link: `/collector`,
          category: "ORDER",
          severity: "INFO",
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            assignedById: auth.user.id,
          },
        },
      });

      // ═══ Audit ═══
      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "COLLECTION_ASSIGN",
        entity: "Order",
        entityId: String(orderId),
        newData: {
          collectorId,
          collectorName: collector.name,
          itemsCount: allItems.length,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });
    });

    return NextResponse.json({
      success: true,
      collectorName: collector.name,
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    console.error("Assign collector error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}