import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({ token: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !["ADMIN", "SUPER_ADMIN"].includes(current.user.role)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ success: false, message: "رمز غير صحيح" }, { status: 400 });

    const handover = await prisma.adminCashHandover.findUnique({
      where: { handoverToken: parsed.data.token },
    });

    if (!handover || handover.status !== "PENDING") {
      return NextResponse.json(
        { success: false, message: "الطلب غير صالح أو تم استلامه مسبقاً" },
        { status: 400 }
      );
    }

    const amount = Number(handover.amount);

    await prisma.$transaction(async (tx) => {
      await tx.adminCashHandover.update({
        where: { id: handover.id },
        data: { status: "COMPLETED", completedAt: new Date(), adminId: current.user.id },
      });

      // 1. خصم من محفظة المستودع (من cashOwedToPlatform)
      const whWallet = await tx.wallet.findUnique({
        where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: 1 } },
      });
      if (!whWallet) throw new Error("محفظة المستودع غير موجودة");

      await tx.wallet.update({
        where: { id: whWallet.id },
        data: {
          cashOwedToPlatform: { decrement: amount },
          cashInHand: { decrement: amount },
        },
      });

      await tx.walletTransactionUnified.create({
        data: {
          walletId: whWallet.id,
          amount: -amount,
          type: "CASH_HANDOVER",
          description: `تحويل أموال المنصة للأدمن`,
          referenceId: String(handover.id),
        },
      });

      // 2. إضافة إلى محفظة الأدمن كـ cashInHand
      const platformWallet = await tx.wallet.upsert({
        where: { ownerType_ownerId: { ownerType: "PLATFORM", ownerId: 1 } },
        create: { ownerType: "PLATFORM", ownerId: 1, cashInHand: amount },
        update: { cashInHand: { increment: amount } },
      });

      await tx.walletTransactionUnified.create({
        data: {
          walletId: platformWallet.id,
          amount: amount,
          type: "CASH_RECEIVED",
          description: `استلام أموال المنصة من المستودع`,
          referenceId: String(handover.id),
        },
      });
    });

    return NextResponse.json({ success: true, amountReceived: amount });
  } catch (error) {
    console.error("Admin handover confirm error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}