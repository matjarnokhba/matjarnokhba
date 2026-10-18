import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const STATUS_FLOW = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

class RewardValidationError extends Error {}

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
    const rewardId = parseInt(id);
    if (isNaN(rewardId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const reward = await prisma.loyaltyReward.findUnique({
      where: { id: rewardId },
      include: { account: true, tier: true, giftProduct: true },
    });

    if (!reward) {
      return NextResponse.json(
        { success: false, message: "المكافأة غير موجودة" },
        { status: 404 }
      );
    }

    // ═══ التحقق المبكر من انتقال الحالة ═══
    if (body.status !== undefined && body.status !== reward.status) {
      if (!STATUS_FLOW.includes(body.status)) {
        return NextResponse.json(
          { success: false, message: "حالة غير صحيحة" },
          { status: 400 }
        );
      }
      const allowed = VALID_TRANSITIONS[reward.status] || [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          {
            success: false,
            message: `لا يمكن الانتقال من ${reward.status} إلى ${body.status}`,
          },
          { status: 400 }
        );
      }
    }

    // ═══ تنفيذ التحديث داخل transaction ذرية ═══
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.loyaltyReward.findUnique({
        where: { id: rewardId },
        select: { status: true, giftProductId: true },
      });
      if (!fresh) throw new RewardValidationError("المكافأة غير موجودة");

      const updates: any = {};

      // ═══ giftProductId ═══
      if (body.giftProductId !== undefined) {
        if (["SHIPPED", "DELIVERED"].includes(fresh.status)) {
          throw new RewardValidationError("لا يمكن تغيير الهدية بعد الشحن");
        }
        if (body.giftProductId === null) {
          if (fresh.giftProductId) {
            await tx.loyaltyGiftProduct.updateMany({
              where: { id: fresh.giftProductId, reservedStock: { gte: 1 } },
              data: { reservedStock: { decrement: 1 } },
            });
          }
          updates.giftProductId = null;
        } else {
          if (fresh.giftProductId) {
            throw new RewardValidationError("الهدية معينة بالفعل");
          }
          const gp = await tx.loyaltyGiftProduct.findUnique({
            where: { id: body.giftProductId },
            select: { id: true, isActive: true, stock: true },
          });
          if (!gp || !gp.isActive) {
            throw new RewardValidationError("منتج الهدية غير متاح");
          }
          const reserved = await tx.loyaltyGiftProduct.updateMany({
            where: {
              id: gp.id,
              isActive: true,
              reservedStock: { lt: gp.stock },
            },
            data: { reservedStock: { increment: 1 } },
          });
          if (reserved.count === 0) {
            throw new RewardValidationError("منتج الهدية غير متوفر في المخزون");
          }
          updates.giftProductId = gp.id;
        }
      }

      // ═══ status ═══
      if (body.status !== undefined) {
        if (!STATUS_FLOW.includes(body.status)) {
          throw new RewardValidationError("حالة غير صحيحة");
        }
        if (body.status !== fresh.status) {
          const allowed = VALID_TRANSITIONS[fresh.status] || [];
          if (!allowed.includes(body.status)) {
            throw new RewardValidationError(
              `لا يمكن الانتقال من ${fresh.status} إلى ${body.status}`
            );
          }
        }
        updates.status = body.status;

        if (body.status === "DELIVERED") {
          updates.deliveredAt = new Date();
          if (fresh.giftProductId) {
            const delivered = await tx.loyaltyGiftProduct.updateMany({
              where: {
                id: fresh.giftProductId,
                reservedStock: { gte: 1 },
                stock: { gte: 1 },
              },
              data: {
                stock: { decrement: 1 },
                reservedStock: { decrement: 1 },
              },
            });
            if (delivered.count === 0) {
              throw new RewardValidationError(
                "تعذر خصم الهدية من المخزون — تحقق من الحجز"
              );
            }
          }
        }

        if (body.status === "CANCELLED") {
          if (fresh.giftProductId) {
            await tx.loyaltyGiftProduct.updateMany({
              where: { id: fresh.giftProductId, reservedStock: { gte: 1 } },
              data: { reservedStock: { decrement: 1 } },
            });
          }
        }
      }

      // ═══ adminNote ═══
      if (body.adminNote !== undefined) {
        updates.adminNote =
          typeof body.adminNote === "string" ? body.adminNote.trim() : null;
      }

      if (Object.keys(updates).length === 0) {
        throw new RewardValidationError("لا توجد تغييرات");
      }

      await tx.loyaltyReward.update({
        where: { id: rewardId },
        data: updates,
      });
    });

    // ═══ إشعار للعميل (خارج الـtransaction) ═══
    if (body.status && body.status !== reward.status) {
      const statusMessages: Record<string, string> = {
        PROCESSING: "🎁 مكافأتك قيد التجهيز",
        SHIPPED: "📦 تم شحن مكافأتك",
        DELIVERED: "✅ تم تسليم مكافأتك",
        CANCELLED: "❌ تم إلغاء المكافأة",
      };

      try {
        await prisma.notification.create({
          data: {
            userId: reward.account.userId,
            type: "ORDER_STATUS_CHANGED",
            title: statusMessages[body.status] || "تحديث المكافأة",
            message:
              body.status === "SHIPPED"
                ? `مكافأة "${reward.tier.name}" في الطريق إليك!`
                : body.status === "DELIVERED"
                  ? `استلمت مكافأة "${reward.tier.name}" — نتمنى أن تنال إعجابك!`
                  : body.status === "CANCELLED"
                    ? `تم إلغاء مكافأة "${reward.tier.name}"${body.adminNote ? `: ${body.adminNote}` : ""}`
                    : `مكافأة "${reward.tier.name}" قيد التجهيز. سنخبرك عند الشحن.`,
            link: "/loyalty",
            category: "ORDER",
            severity: body.status === "CANCELLED" ? "WARNING" : "INFO",
          },
        });
      } catch (notifErr) {
        console.error("Notification failed:", notifErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RewardValidationError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    console.error("Admin reward PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}