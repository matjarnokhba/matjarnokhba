import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { InventoryService } from "@/services/inventory.service";

// ═══════ الحماية ═══════
function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  // في التطوير: اسمح بدون secret
  if (process.env.NODE_ENV !== "production") return true;

  // في الإنتاج: يجب أن يطابق CRON_SECRET
  if (!secret) {
    console.error("CRON_SECRET غير معرّف في متغيرات البيئة");
    return false;
  }
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, message: "غير مصرح" },
      { status: 401 }
    );
  }

  try {
    const now = new Date();

    // ═══════ جلب الحجوزات المنتهية ═══════
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lt: now },
        order: { status: "NEW" },
      },
      include: {
        items: true,
        order: { select: { id: true, orderNumber: true, userId: true } },
      },
      take: 50, // دفعة واحدة كل مرة
    });

    if (expiredReservations.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "لا توجد حجوزات منتهية",
      });
    }

    let processed = 0;
    let failed = 0;

    for (const reservation of expiredReservations) {
      try {
        await prisma.$transaction(async (tx) => {
          // ═══════ Lock Order ═══════
          const order = await tx.order.findUnique({
            where: { id: reservation.orderId },
            select: { id: true, status: true, userId: true, orderNumber: true },
          });

          if (!order || order.status !== "NEW") {
            // لم يعد NEW → تجاهل
            return;
          }

          // ═══════ Lock Reservation ═══════
          const freshReservation = await tx.reservation.findUnique({
            where: { id: reservation.id },
          });

          if (!freshReservation || freshReservation.status !== "ACTIVE") {
            return;
          }

          // ═══════ تحرير المخزون ═══════
          for (const item of reservation.items) {
            await InventoryService.unreserve(
              tx,
              item.variantId,
              item.quantity,
              order.id,
              "انتهاء مدة الحجز (30 دقيقة)"
            );
          }

          // ═══════ Reservation = EXPIRED ═══════
          await tx.reservation.update({
            where: { id: reservation.id },
            data: {
              status: "EXPIRED",
              releasedAt: now,
              releaseReason: "AUTO_EXPIRED",
            },
          });

          // ═══════ Order = CANCELLED ═══════
          await tx.order.update({
            where: { id: order.id },
            data: { status: "CANCELLED" },
          });

          // ═══════ StatusHistory ═══════
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: "NEW",
              toStatus: "CANCELLED",
              changedById: order.userId, // النظام نيابة عن المستخدم
              note: "انتهت مدة الحجز (30 دقيقة) — إلغاء تلقائي",
            },
          });

          // ═══════ إشعار ═══════
          await tx.notification.create({
            data: {
              userId: order.userId,
              type: "ORDER_STATUS_CHANGED",
              title: "انتهت مدة الحجز",
              message: `طلبك ${order.orderNumber} أُلغي تلقائياً لعدم التأكيد خلال 30 دقيقة.`,
              link: `/orders/${order.id}`,
            },
          });
        });

        processed++;
      } catch (err) {
        console.error(`فشل معالجة Reservation ${reservation.id}:`, err);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      failed,
      total: expiredReservations.length,
    });
  } catch (error) {
    console.error("Cron expire-reservations error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}