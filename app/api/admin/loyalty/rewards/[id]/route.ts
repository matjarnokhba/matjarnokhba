import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const STATUS_FLOW = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

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

    const updates: any = {};

    // ═══ تعيين منتج هدية ═══
    if (body.giftProductId !== undefined) {
      if (body.giftProductId === null) {
        updates.giftProductId = null;
      } else {
        const gp = await prisma.loyaltyGiftProduct.findUnique({
          where: { id: body.giftProductId, isActive: true },
        });
        if (!gp) {
          return NextResponse.json(
            { success: false, message: "منتج الهدية غير متاح" },
            { status: 400 }
          );
        }

        // تحقق من المخزون
        const available = gp.stock - gp.reservedStock;
        if (available <= 0) {
          return NextResponse.json(
            { success: false, message: "منتج الهدية غير متوفر في المخزون" },
            { status: 400 }
          );
        }

        // ═══ الحجز: ننقص من المخزون المتاح ═══
        await prisma.loyaltyGiftProduct.update({
          where: { id: gp.id },
          data: { reservedStock: { increment: 1 } },
        });

        updates.giftProductId = gp.id;
      }
    }

    // ═══ تغيير الحالة ═══
    if (body.status !== undefined) {
      if (!STATUS_FLOW.includes(body.status)) {
        return NextResponse.json(
          { success: false, message: "حالة غير صحيحة" },
          { status: 400 }
        );
      }
      updates.status = body.status;

      if (body.status === "DELIVERED") {
        updates.deliveredAt = new Date();

        // ═══ خصم فعلي من المخزون عند التسليم ═══
        if (reward.giftProductId) {
          await prisma.loyaltyGiftProduct.update({
            where: { id: reward.giftProductId },
            data: {
              stock: { decrement: 1 },
              reservedStock: { decrement: 1 },
            },
          });
        }
      }

      if (body.status === "CANCELLED") {
        // ═══ تحرير الحجز إن وجد ═══
        if (reward.giftProductId) {
          await prisma.loyaltyGiftProduct.update({
            where: { id: reward.giftProductId },
            data: { reservedStock: { decrement: 1 } },
          });
        }
      }
    }

    // ═══ ملاحظة أدمن ═══
    if (body.adminNote !== undefined) {
      updates.adminNote = typeof body.adminNote === "string" ? body.adminNote.trim() : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد تغييرات" },
        { status: 400 }
      );
    }

    await prisma.loyaltyReward.update({
      where: { id: rewardId },
      data: updates,
    });

    // ═══ إشعار للعميل ═══
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
    console.error("Admin reward PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}