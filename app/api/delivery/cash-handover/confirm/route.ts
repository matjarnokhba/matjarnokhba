import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  token: z.string().uuid(),
  actualAmount: z.number().min(0),
});

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "DELIVERY") {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });

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

    const expected = Number(handover.amount);
    const actual = parsed.data.actualAmount;
    const shortfall = Math.max(0, expected - actual);

    await prisma.$transaction(async (tx) => {
      // 1. تحديث حالة التسليم بالمبلغ الفعلي
      await tx.cashHandover.update({
        where: { id: handover.id },
        data: { status: "COMPLETED", completedAt: new Date(), shortfall: shortfall }
      });

      // 2. محفظة السائق: خصم الكاش بالكامل (120) وتطبيق الخصم إذا وجد نقص
      const driverWallet = await tx.wallet.findUnique({
        where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: person.id } }
      });

      const driverCashBefore = driverWallet ? Number(driverWallet.cashInHand) : 0;
      const driverBalBefore = driverWallet ? Number(driverWallet.balance) : 0;

      await tx.wallet.update({
        where: { id: driverWallet!.id },
        data: {
          cashInHand: { decrement: expected },
          balance: { decrement: shortfall },
          isBlocked: (driverCashBefore - expected > 0), // إذا بقي كاش آخر، يظل محظوراً
        }
      });

      // تسجيل حركة السائق (الأجر أو الخصم)
      await tx.walletTransactionUnified.create({
        data: {
          walletId: driverWallet!.id,
          amount: -shortfall,
          type: "SHORTFALL",
          description: `خصم عجز في تسليم الكاش (تم تسليم ${actual} من ${expected})`,
        }
      });

      // 3. محفظة المستودع: إضافة المبلغ المستلم فقط
      const warehouseWallet = await tx.wallet.upsert({
        where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: handover.warehouseId } },
        create: { ownerType: "WAREHOUSE", ownerId: handover.warehouseId, cashInHand: actual },
        update: { cashInHand: { increment: actual } }
      });

      await tx.walletTransactionUnified.create({
        data: {
          walletId: warehouseWallet.id,
          amount: actual,
          type: "CASH_COLLECTED",
          description: `استلام كاش من السائق #${person.id}`,
        }
      });
    });

    return NextResponse.json({
      success: true,
      amountReceived: actual,
      shortfallDeducted: shortfall
    });

  } catch (error) {
    console.error("Cash handover confirm error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}