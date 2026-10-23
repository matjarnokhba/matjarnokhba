import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  token: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "DELIVERY") {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, message: "رمز غير صحيح" }, { status: 400 });

    const person = await prisma.deliveryPerson.findUnique({
      where: { userId: current.user.id },
      select: { id: true }
    });
    if (!person) return NextResponse.json({ success: false, message: "السائق غير موجود" }, { status: 404 });

    const handover = await prisma.cashHandover.findUnique({
      where: { handoverToken: parsed.data.token }
    });

    if (!handover || handover.driverId !== person.id || handover.status !== "PENDING") {
      return NextResponse.json({ success: false, message: "الطلب غير صالح أو تم تسليمه مسبقاً" }, { status: 400 });
    }

    const actualAmount = Number(handover.amount);
    const shortfall = Number(handover.shortfall);

    await prisma.$transaction(async (tx) => {
      // 1. تحديث حالة التسليم
      await tx.cashHandover.update({
        where: { id: handover.id },
        data: { status: "COMPLETED", completedAt: new Date() }
      });

      // 2. محفظة السائق: خصم الكاش الذي كان في حوزته + خصم النقص من رصيده
      const driverWallet = await tx.wallet.findUnique({
        where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: person.id } }
      });
      if (!driverWallet) throw new Error("محفظة السائق غير موجودة");

      // المبلغ الذي يجب أن يخرج من cashInHand هو (actual + shortfall) = expected
      const totalExpected = actualAmount + shortfall;

      await tx.wallet.update({
        where: { id: driverWallet.id },
        data: {
          cashInHand: { decrement: totalExpected },
          balance: { decrement: shortfall }, // خصم النقص من استحقاقات السائق
          isBlocked: false, // فك الحظر بعد التسليم
        }
      });

      if (shortfall > 0) {
        await tx.walletTransactionUnified.create({
          data: {
            walletId: driverWallet.id,
            amount: -shortfall,
            type: "SHORTFALL",
            description: `خصم عجز في تسليم الكاش (تم تسليم ${actualAmount} من ${totalExpected})`,
          }
        });
      }

      // 3. محفظة المستودع: إضافة المبلغ المستلم فقط
      const warehouseWallet = await tx.wallet.upsert({
        where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: handover.warehouseId } },
        create: { ownerType: "WAREHOUSE", ownerId: handover.warehouseId, cashInHand: actualAmount },
        update: { cashInHand: { increment: actualAmount } }
      });

      await tx.walletTransactionUnified.create({
        data: {
          walletId: warehouseWallet.id,
          amount: actualAmount,
          type: "CASH_COLLECTED",
          description: `استلام كاش من السائق #${person.id}`,
        }
      });
    });

    return NextResponse.json({
      success: true,
      amountReceived: actualAmount,
      shortfallDeducted: shortfall
    });

  } catch (error) {
    console.error("Cash handover confirm error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}