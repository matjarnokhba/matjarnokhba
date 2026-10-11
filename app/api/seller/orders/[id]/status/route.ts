import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { InventoryService } from "@/services/inventory.service";
import { AuditService } from "@/services/audit.service";

// ═══════════════════════════════════════════
// التاجر:
// - NEW → PROCESSING  (قبول)
// - NEW → CANCELLED   (رفض، بسبب إجباري)
// - PROCESSING → SHIPPED
// التاجر لا يستطيع: DELIVERED / RETURNED / CANCELLED بعد PROCESSING
// ═══════════════════════════════════════════
const SELLER_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEW: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: [],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: [],
};

async function requireSeller() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };
  return { user: current.user, seller: current.user.seller };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSeller();
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
    const newStatus = body.status;
    const note = body.note?.trim() || null;

    // ═══ سبب الرفض إجباري ═══
    if (newStatus === "CANCELLED") {
      if (!note || note.length < 5) {
        return NextResponse.json(
          {
            success: false,
            message: "سبب الرفض مطلوب (5 أحرف على الأقل)",
          },
          { status: 400 }
        );
      }
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, sellerId: auth.seller.id },
      include: {
        items: {
          select: {
            id: true,
            variantId: true,
            quantity: true,
            productId: true,
            fulfillmentItems: {
              select: { id: true, status: true, orderItemId: true },
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

    const oldStatus = order.status;

    const allowed = SELLER_ALLOWED_TRANSITIONS[oldStatus] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          message:
            oldStatus === "SHIPPED"
              ? "لا يمكنك إتمام التوصيل. التسليم يتم عبر السائق أو الإدارة."
              : `لا يمكن الانتقال من ${oldStatus} إلى ${newStatus}`,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // ═══ 1. تحديث حالة الطلب ═══
      await tx.order.update({
        where: { id: orderId },
        data: { status: newStatus },
      });

      // ═══ 2. تحديث FulfillmentItems حسب الانتقال ═══
      const allFulfillmentItems = order.items.flatMap(
        (item) => item.fulfillmentItems
      );

      if (newStatus === "PROCESSING") {
        // PENDING → PREPARING
        for (const fi of allFulfillmentItems) {
          if (fi.status !== "PENDING") continue;

          await tx.fulfillmentItem.update({
            where: { id: fi.id },
            data: {
              status: "PREPARING",
              preparedAt: new Date(),
              preparedById: auth.user.id,
            },
          });

          await tx.fulfillmentStatusHistory.create({
            data: {
              fulfillmentItemId: fi.id,
              fromStatus: "PENDING",
              toStatus: "PREPARING",
              changedById: auth.user.id,
              note: "قبول التاجر للطلب",
            },
          });
        }
      }

      if (newStatus === "CANCELLED") {
        // PENDING → CANCELLED
        for (const fi of allFulfillmentItems) {
          if (fi.status === "CANCELLED") continue;

          await tx.fulfillmentItem.update({
            where: { id: fi.id },
            data: { status: "CANCELLED" },
          });

          await tx.fulfillmentStatusHistory.create({
            data: {
              fulfillmentItemId: fi.id,
              fromStatus: fi.status as any,
              toStatus: "CANCELLED",
              changedById: auth.user.id,
              note: `رفض التاجر: ${note}`,
            },
          });
        }

        // ═══ إرجاع المخزون (idempotent) ═══
        const sorted = order.items
          .filter((i): i is typeof i & { variantId: number } =>
            i.variantId !== null
          )
          .sort((a, b) => a.variantId - b.variantId);

        for (const item of sorted) {
          await InventoryService.cancelReturn(
            tx,
            item.variantId,
            item.quantity,
            orderId,
            `رفض التاجر: ${note}`
          );
        }
      }

      // ═══ 3. سجل الطلب ═══
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: oldStatus,
          toStatus: newStatus,
          changedById: auth.user.id,
          note:
            newStatus === "CANCELLED"
              ? `رفض التاجر: ${note}`
              : note || "قبول التاجر وبدء التجهيز",
        },
      });

      // ═══ 4. إشعار العميل ═══
      await tx.notification.create({
        data: {
          userId: order.userId,
          type: "ORDER_STATUS_CHANGED",
          title:
            newStatus === "CANCELLED"
              ? "تم رفض طلبك"
              : "تحديث حالة الطلب",
          message:
            newStatus === "CANCELLED"
              ? `تم رفض طلبك ${order.orderNumber}. السبب: ${note}`
              : `طلبك ${order.orderNumber} قيد التجهيز`,
          link: `/orders/${order.id}`,
          category: "ORDER",
          severity: newStatus === "CANCELLED" ? "WARNING" : "INFO",
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            oldStatus,
            newStatus,
            reason: note,
          },
        },
      });

      // ═══ 5. إشعار الأدمن ═══
      const admins = await tx.user.findMany({
        where: {
          role: { in: ["ADMIN", "SUPER_ADMIN"] },
          deletedAt: null,
        },
        select: { id: true },
      });

      for (const admin of admins) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            type: "ORDER_STATUS_CHANGED",
            title:
              newStatus === "CANCELLED"
                ? "❌ التاجر رفض طلبًا"
                : "🔄 تحديث حالة طلب",
            message:
              newStatus === "CANCELLED"
                ? `التاجر "${auth.seller.storeName}" رفض الطلب ${order.orderNumber}. السبب: ${note}`
                : `التاجر "${auth.seller.storeName}" بدأ تجهيز الطلب ${order.orderNumber}`,
            link: `/admin/orders/${order.id}`,
            category: "ORDER",
            severity: newStatus === "CANCELLED" ? "WARNING" : "INFO",
            metadata: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              oldStatus,
              newStatus,
              sellerId: auth.seller.id,
              sellerName: auth.seller.storeName,
              reason: note,
            },
          },
        });
      }

      // ═══ 6. Audit ═══
      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "STATUS_CHANGE",
        entity: "Order",
        entityId: String(orderId),
        oldData: { status: oldStatus },
        newData: {
          status: newStatus,
          reason: note,
          sellerId: auth.seller.id,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Seller order status error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}