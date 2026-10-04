import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { InventoryService } from "@/services/inventory.service";

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV !== "production") return true;

  if (!secret) {
    console.error("CRON_SECRET غير معرّف في متغيرات البيئة");
    return false;
  }
  return authHeader === `Bearer ${secret}`;
}

type OrderResult = {
  orderId: number;
  orderNumber: string;
  userId: number;
} | null;

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, message: "غير مصرح" },
      { status: 401 }
    );
  }

  try {
    const now = new Date();

    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lt: now },
        order: { status: "NEW" },
      },
      include: {
        items: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            userId: true,
            couponUsage: { select: { id: true, couponId: true } },
          },
        },
      },
      take: 50,
    });

    if (expiredReservations.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "لا توجد حجوزات منتهية",
      });
    }

    const notifications: any[] = [];
    let processed = 0;
    let failed = 0;

    for (const reservation of expiredReservations) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          // ═══ Lock Reservation (FOR UPDATE) ═══
          const lockRows: any[] = await tx.$queryRaw`
            SELECT id, status
            FROM "Reservation"
            WHERE id = ${reservation.id}
            FOR UPDATE
          `;

          if (!lockRows[0] || lockRows[0].status !== "ACTIVE") {
            return null; // عُولج من مكان آخر
          }

          // ═══ Lock Order ═══
          const orderLock: any[] = await tx.$queryRaw`
            SELECT id, status
            FROM "Order"
            WHERE id = ${reservation.orderId}
            FOR UPDATE
          `;

          if (!orderLock[0] || orderLock[0].status !== "NEW") {
            return null; // لم يعد NEW
          }

          const order = reservation.order;

          // ═══ تحرير المخزون ═══
          const sortedItems = [...reservation.items].sort(
            (a, b) => a.variantId - b.variantId
          );

          for (const item of sortedItems) {
            await InventoryService.unreserve(
              tx,
              item.variantId,
              item.quantity,
              order.id,
              "انتهاء مدة الحجز (30 دقيقة)"
            );
          }

          // ═══ Reservation = EXPIRED ═══
          await tx.reservation.update({
            where: { id: reservation.id },
            data: {
              status: "EXPIRED",
              releasedAt: now,
              releaseReason: "AUTO_EXPIRED",
            },
          });

          // ═══ Order = CANCELLED ═══
          await tx.order.update({
            where: { id: order.id },
            data: { status: "CANCELLED" },
          });

          // ═══ StatusHistory ═══
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: "NEW",
              toStatus: "CANCELLED",
              changedById: order.userId,
              note: "انتهت مدة الحجز (30 دقيقة) — إلغاء تلقائي",
            },
          });

          // ═══ 🔴 تحرير الكوبون ═══
          if (order.couponUsage) {
            await tx.coupon.update({
              where: { id: order.couponUsage.couponId },
              data: { usedCount: { decrement: 1 } },
            });

            await tx.couponUsage.delete({
              where: { id: order.couponUsage.id },
            });
          }

          return {
            orderId: order.id,
            orderNumber: order.orderNumber,
            userId: order.userId,
          };
        });

        if (result) {
          processed++;
          notifications.push({
            userId: result.userId,
            type: "ORDER_STATUS_CHANGED",
            title: "انتهت مدة الحجز",
            message: `طلبك ${result.orderNumber} أُلغي تلقائياً لعدم التأكيد خلال 30 دقيقة.`,
            link: `/orders/${result.orderId}`,
          });
        }
      } catch (err) {
        console.error(`فشل معالجة Reservation ${reservation.id}:`, err);
        failed++;
      }
    }

    // ═══ الإشعارات (خارج Transactions) ═══
    if (notifications.length > 0) {
      try {
        await prisma.notification.createMany({ data: notifications });
      } catch (notifErr) {
        console.error("Notifications failed:", notifErr);
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