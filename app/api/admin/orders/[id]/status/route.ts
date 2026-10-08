import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { InventoryService } from "@/services/inventory.service";
import { LoyaltyService } from "@/services/loyalty.service";
import { ReferralService } from "@/services/referral.service";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEW: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "جديد",
  PROCESSING: "قيد التجهيز",
  SHIPPED: "تم الشحن",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغى",
  RETURNED: "مُرتجع",
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
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      );
    }

    const oldStatus = order.status;

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

    let loyaltyResult: {
      pointsAwarded: number;
      balanceAfter: number;
      unlockedTiers: Array<{
        tierId: number;
        name: string;
        icon: string | null;
        rewardId: number;
      }>;
    } | null = null;

    // ═══════ Transaction ═══════
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

      // ═══ 3. CANCELLED: إرجاع المخزون (COD = Sale عند الإنشاء) ═══
      if (newStatus === "CANCELLED") {
        const alreadyReturned = await tx.inventoryMovement.findFirst({
          where: {
            referenceType: "ORDER",
            referenceId: BigInt(orderId),
            type: "RETURN",
            reason: "إلغاء الطلب — إرجاع للمخزون",
          },
        });

        if (!alreadyReturned) {
          const itemsWithVariant = order.items.filter(
            (i): i is { variantId: number; quantity: number } =>
              i.variantId !== null
          );

          const sortedItems = [...itemsWithVariant].sort(
            (a, b) => a.variantId - b.variantId
          );

          for (const item of sortedItems) {
            await InventoryService.cancelReturn(
              tx,
              item.variantId,
              item.quantity,
              orderId
            );
          }
        }
      }

      // ═══ 4. DELIVERED: زيادة المبيعات + منح نقاط الولاء + مكافأة الإحالة ═══
      if (newStatus === "DELIVERED" && oldStatus !== "DELIVERED") {
        // 4a. زيادة sold
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

        // 4b. منح نقاط الولاء
        try {
          const award = await LoyaltyService.awardForOrder(tx, {
            userId: order.userId,
            orderId: order.id,
            orderTotal: Number(order.total),
          });

          loyaltyResult = award;

          if (award.pointsAwarded > 0) {
            await tx.order.update({
              where: { id: orderId },
              data: {
                loyaltyPointsAwarded: award.pointsAwarded,
                loyaltyAwardedAt: new Date(),
              },
            });

            await tx.notification.create({
              data: {
                userId: order.userId,
                type: "ORDER_STATUS_CHANGED",
                title: "🎁 ربحت نقاط ولاء!",
                message: `حصلت على ${award.pointsAwarded} نقطة من الطلب ${order.orderNumber}. رصيدك الآن: ${award.balanceAfter} نقطة.`,
                link: `/loyalty`,
                category: "ORDER",
                severity: "INFO",
                metadata: {
                  orderId: order.id,
                  pointsAwarded: award.pointsAwarded,
                  balanceAfter: award.balanceAfter,
                },
              },
            });
          }

          for (const tier of award.unlockedTiers) {
            await tx.notification.create({
              data: {
                userId: order.userId,
                type: "ORDER_STATUS_CHANGED",
                title: `${tier.icon || "🎁"} مبروك! فتحت ${tier.name}`,
                message: `وصلت إلى مستوى "${tier.name}". اختر فئة الهدية المفضلة لديك!`,
                link: `/loyalty`,
                category: "ORDER",
                severity: "INFO",
                metadata: {
                  tierId: tier.tierId,
                  rewardId: tier.rewardId,
                  tierName: tier.name,
                },
              },
            });
          }
        } catch (loyaltyErr) {
          console.error("Loyalty award failed:", loyaltyErr);
        }

        // 4c. مكافأة الإحالة عند أول طلب مؤهل
        try {
          await ReferralService.awardOnFirstOrder(tx, order.userId, order.id);
        } catch (refErr) {
          console.error("Referral award failed:", refErr);
        }
      }

      // ═══ 5. إشعار الحالة (عام) ═══
      await tx.notification.create({
        data: {
          userId: order.userId,
          type: "ORDER_STATUS_CHANGED",
          title: "تحديث حالة الطلب",
          message: `طلبك ${order.orderNumber} أصبح: ${STATUS_LABELS[newStatus] || newStatus}`,
          link: `/orders/${order.id}`,
        },
      });
    });

    return NextResponse.json({ success: true, loyalty: loyaltyResult });
  } catch (error) {
    console.error("Status update error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}