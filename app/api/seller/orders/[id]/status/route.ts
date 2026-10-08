import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { LoyaltyService } from "@/services/loyalty.service";
import { ReferralService } from "@/services/referral.service";

const SELLER_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEW: ["PROCESSING"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
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

    const order = await prisma.order.findFirst({
      where: { id: orderId, sellerId: auth.seller.id },
      include: {
        items: {
          select: { variantId: true, quantity: true, productId: true },
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
          message: `لا يمكن الانتقال من ${oldStatus} إلى ${newStatus}`,
        },
        { status: 400 }
      );
    }

    // ═══ Transaction ═══
    await prisma.$transaction(async (tx) => {
      // 1. تحديث الحالة
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          ...(newStatus === "DELIVERED"
            ? { deliveredAt: new Date(), paymentStatus: "PAID" }
            : {}),
        },
      });

      // 2. سجل الحالة
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: oldStatus,
          toStatus: newStatus,
          changedById: auth.user.id,
          note: note || "تحديث من التاجر",
        },
      });

      // ═══ 3. DELIVERED: زيادة المبيعات + منح نقاط الولاء + مكافأة الإحالة ═══
      if (newStatus === "DELIVERED" && oldStatus !== "DELIVERED") {
        // 3a. زيادة sold
        const soldByProduct = new Map<number, number>();
        for (const item of order.items) {
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

        // 3b. منح نقاط الولاء
        try {
          const award = await LoyaltyService.awardForOrder(tx, {
            userId: order.userId,
            orderId: order.id,
            orderTotal: Number(order.total),
          });

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

        // 3c. مكافأة الإحالة عند أول طلب مؤهل
        try {
          await ReferralService.awardOnFirstOrder(tx, order.userId, order.id);
        } catch (refErr) {
          console.error("Referral award failed:", refErr);
        }
      }

      // ═══ 4. إشعار للعميل ═══
      await tx.notification.create({
        data: {
          userId: order.userId,
          type: "ORDER_STATUS_CHANGED",
          title: "تحديث حالة الطلب",
          message: `طلبك ${order.orderNumber} أصبح: ${statusLabel(newStatus)}`,
          link: `/orders/${order.id}`,
          category: "ORDER",
          severity: "INFO",
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            oldStatus,
            newStatus,
          },
        },
      });

      // ═══ 5. إشعار للأدمن ═══
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
            title: "🔄 تحديث حالة طلب",
            message: `التاجر "${auth.seller.storeName}" حدّث طلب ${order.orderNumber} إلى: ${statusLabel(newStatus)}`,
            link: `/admin/orders/${order.id}`,
            category: "ORDER",
            severity: "INFO",
            metadata: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              oldStatus,
              newStatus,
              sellerId: auth.seller.id,
              sellerName: auth.seller.storeName,
            },
          },
        });
      }
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

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    NEW: "جديد",
    PROCESSING: "قيد التجهيز",
    SHIPPED: "تم الشحن",
    DELIVERED: "تم التوصيل",
    CANCELLED: "ملغى",
    RETURNED: "مُرتجع",
  };
  return labels[status] || status;
}