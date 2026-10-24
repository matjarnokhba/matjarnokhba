import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({ token: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "DELIVERY") {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ success: false, message: "رمز غير صحيح" }, { status: 400 });

    const person = await prisma.deliveryPerson.findUnique({
      where: { userId: current.user.id },
      select: { id: true },
    });
    if (!person)
      return NextResponse.json({ success: false, message: "السائق غير موجود" }, { status: 404 });

    const handover = await prisma.cashHandover.findUnique({
      where: { handoverToken: parsed.data.token },
    });

    if (!handover || handover.driverId !== person.id || handover.status !== "PENDING") {
      return NextResponse.json(
        { success: false, message: "الطلب غير صالح أو تم تسليمه مسبقاً" },
        { status: 400 }
      );
    }

    const actualAmount = Number(handover.amount);
    const shortfall = Number(handover.shortfall);

    await prisma.$transaction(async (tx) => {
      await tx.cashHandover.update({
        where: { id: handover.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      const driverWallet = await tx.wallet.findUnique({
        where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: person.id } },
      });
      if (!driverWallet) throw new Error("محفظة السائق غير موجودة");

      const totalExpected = actualAmount + shortfall;
      const cashBefore = Number(driverWallet.cashInHand);
      const cashAfter = cashBefore - totalExpected;
      const cashCleared = cashAfter <= 0; // إذا انتهى الكاش

      await tx.wallet.update({
        where: { id: driverWallet.id },
        data: {
          cashInHand: { decrement: totalExpected },
          balance: { decrement: shortfall },
          // إذا انتهى الكاش، نمسح تاريخ الحيازة ونفك الحظر
          ...(cashCleared && { cashHeldSince: null, isBlocked: false, blockReason: null }),
        },
      });

      if (shortfall > 0) {
        await tx.walletTransactionUnified.create({
          data: {
            walletId: driverWallet.id,
            amount: -shortfall,
            type: "SHORTFALL",
            description: `خصم عجز (تم تسليم ${actualAmount} من ${totalExpected})`,
          },
        });
      }

      // ═══ محفظة المستودع (بـ ID ثابت = 1) ═══
      const warehouseWallet = await tx.wallet.upsert({
        where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: 1 } },
        create: { ownerType: "WAREHOUSE", ownerId: 1, cashInHand: actualAmount },
        update: { cashInHand: { increment: actualAmount } },
      });

      await tx.walletTransactionUnified.create({
        data: {
          walletId: warehouseWallet.id,
          amount: actualAmount,
          type: "CASH_COLLECTED",
          description: `استلام كاش من السائق #${person.id}`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      amountReceived: actualAmount,
      shortfallDeducted: shortfall,
    });
  } catch (error) {
    console.error("Cash handover confirm error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}