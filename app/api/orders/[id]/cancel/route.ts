import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { InventoryService } from "@/services/inventory.service";

const CUSTOMER_CANCEL_WINDOW_MS = 60 * 60 * 1000; // 1 ساعة

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
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

    await prisma.$transaction(async (tx) => {
      // Lock Order
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          reservation: {
            include: {
              items: { select: { variantId: true, quantity: true } },
            },
          },
        },
      });

      if (!order) throw new Error("الطلب غير موجود");
      if (order.userId !== current.user.id) throw new Error("غير مصرح");
      if (order.status !== "NEW") {
        throw new Error("لا يمكن إلغاء الطلب في هذه المرحلة");
      }

      // نافذة الإلغاء (ساعة واحدة)
      const elapsed = Date.now() - order.createdAt.getTime();
      if (elapsed > CUSTOMER_CANCEL_WINDOW_MS) {
        throw new Error("انتهت مدة الإلغاء المسموحة");
      }

      // تحرير الحجز
      if (order.reservation && order.reservation.status === "ACTIVE") {
        for (const item of order.reservation.items) {
          await InventoryService.unreserve(
            tx,
            item.variantId,
            item.quantity,
            order.id,
            "إلغاء من قبل العميل"
          );
        }

        await tx.reservation.update({
          where: { id: order.reservation.id },
          data: {
            status: "RELEASED",
            releasedAt: new Date(),
            releaseReason: "CUSTOMER_CANCELLED",
          },
        });
      }

      // تحديث حالة الطلب
      await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: "NEW",
          toStatus: "CANCELLED",
          changedById: current.user.id,
          note: "إلغاء من قبل العميل",
        },
      });

      await tx.notification.create({
        data: {
          userId: order.userId,
          type: "ORDER_STATUS_CHANGED",
          title: "تم إلغاء الطلب",
          message: `طلبك ${order.orderNumber} أُلغي بنجاح.`,
          link: `/orders/${order.id}`,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Order cancel error:", error);
    const message = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}