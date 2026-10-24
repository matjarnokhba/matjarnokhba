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

    const payout = await prisma.driverPayout.findUnique({
      where: { payoutToken: parsed.data.token },
    });

    if (!payout || payout.driverId !== person.id || payout.status !== "PENDING") {
      return NextResponse.json(
        { success: false, message: "الطلب غير صالح أو تم دفعه مسبقاً" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.driverPayout.update({
        where: { id: payout.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      // 1. خصم من محفظة السائق
      const driverWallet = await tx.wallet.findUnique({
        where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: person.id } },
      });
      if (!driverWallet) throw new Error("محفظة السائق غير موجودة");

      await tx.wallet.update({
        where: { id: driverWallet.id },
        data: { balance: { decrement: payout.amount } },
      });

      await tx.walletTransactionUnified.create({
        data: {
          walletId: driverWallet.id,
          amount: -Number(payout.amount),
          type: "WITHDRAWAL",
          description: `استلام أجر توصيلات (${payout.method === "CASH" ? "نقداً" : "تحويل بنكي"})`,
          referenceId: String(payout.id),
        },
      });

      // 2. خصم من محفظة المستودع (من cashOwedToDrivers و cashInHand)
      const warehouseWallet = await tx.wallet.findUnique({
        where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: 1 } },
      });
      if (!warehouseWallet) throw new Error("محفظة المستودع غير موجودة");

      await tx.wallet.update({
        where: { id: warehouseWallet.id },
        data: {
          cashOwedToDrivers: { decrement: payout.amount },
          cashInHand: { decrement: payout.amount },
        },
      });

      await tx.walletTransactionUnified.create({
        data: {
          walletId: warehouseWallet.id,
          amount: -Number(payout.amount),
          type: "DRIVER_PAYOUT",
          description: `دفع أجر للسائق #${person.id}`,
          referenceId: String(payout.id),
        },
      });
    });

    return NextResponse.json({
      success: true,
      amountReceived: Number(payout.amount),
      method: payout.method,
    });
  } catch (error) {
    console.error("Driver payout confirm error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}