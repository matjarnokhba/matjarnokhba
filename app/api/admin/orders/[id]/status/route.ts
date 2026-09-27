import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { InventoryService } from "@/services/inventory.service";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEW: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const orderId = parseInt(id);
    const body = await request.json();
    const newStatus = body.status;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { select: { variantId: true, quantity: true } },
        reservation: {
          include: {
            items: { select: { variantId: true, quantity: true } },
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

    // التحقق من الانتقال
    const allowed = ALLOWED_TRANSITIONS[oldStatus] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن الانتقال من ${oldStatus} إلى ${newStatus}`,
        },
        { status: 400 }
      );
    }

    // ═══════ التحديث ═══════
    await prisma.$transaction(async (tx) => {
      // 1. تحديث حالة الطلب
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          ...(newStatus === "DELIVERED"
            ? { deliveredAt: new Date(), paymentStatus: "PAID" }
            : {}),
        },
      });

      // 2. OrderStatusHistory
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: oldStatus,
          toStatus: newStatus,
          changedById: current.user.id,
          note: "تغيير من لوحة الإدارة",
        },
      });

      // ═══════ 3. NEW → PROCESSING: تأكيد الحجز + خصم المخزون ═══════
      if (oldStatus === "NEW" && newStatus === "PROCESSING") {
        const reservation = await tx.reservation.findUnique({
          where: { orderId },
          include: { items: true },
        });

        if (reservation && reservation.status === "ACTIVE") {
          // خصم من المخزون لكل item
          for (const item of reservation.items) {
            await InventoryService.commitSale(
              tx,
              item.variantId,
              item.quantity,
              orderId
            );
          }

          // تأكيد الحجز
          await tx.reservation.update({
            where: { id: reservation.id },
            data: { status: "CONFIRMED" },
          });
        }
      }

      // ═══════ 4. CANCELLED: تحرير الحجز ═══════
      if (newStatus === "CANCELLED") {
        const reservation = await tx.reservation.findUnique({
          where: { orderId },
          include: { items: true },
        });

        if (reservation) {
          if (oldStatus === "NEW" && reservation.status === "ACTIVE") {
            // لم يُخصم بعد → حرّر الحجز فقط
            for (const item of reservation.items) {
              await InventoryService.unreserve(
                tx,
                item.variantId,
                item.quantity,
                orderId,
                "إلغاء الطلب"
              );
            }

            await tx.reservation.update({
              where: { id: reservation.id },
              data: {
                status: "RELEASED",
                releasedAt: new Date(),
                releaseReason: "CANCELLED",
              },
            });
          } else if (
            oldStatus === "PROCESSING" &&
            reservation.status === "CONFIRMED"
          ) {
            // خُصم فعلاً → أعد للمخزون
            for (const item of reservation.items) {
              await InventoryService.returnStock(
                tx,
                item.variantId,
                item.quantity,
                0 // لا يوجد ReturnRequest
              );
            }

            await tx.reservation.update({
              where: { id: reservation.id },
              data: {
                status: "RELEASED",
                releasedAt: new Date(),
                releaseReason: "CANCELLED_AFTER_CONFIRM",
              },
            });
          }
        }
      }

      // ═══════ 5. إشعار ═══════
      await tx.notification.create({
        data: {
          userId: order.userId,
          type: "ORDER_STATUS_CHANGED",
          title: "تحديث حالة الطلب",
          message: `طلبك ${order.orderNumber} أصبح: ${newStatus}`,
          link: `/orders/${order.id}`,
        },
      });

      // ═══════ 6. DELIVERED: زيادة المبيعات ═══════
      if (newStatus === "DELIVERED" && oldStatus !== "DELIVERED") {
        const soldByProduct = new Map<number, number>();
        const fullItems = await tx.orderItem.findMany({
          where: { orderId },
          select: { productId: true, quantity: true },
        });
        for (const item of fullItems) {
          soldByProduct.set(
            item.productId,
            (soldByProduct.get(item.productId) || 0) + item.quantity
          );
        }

        for (const [productId, qty] of soldByProduct) {
          await tx.product.update({
            where: { id: productId },
            data: { sold: { increment: qty } },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Status update error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}