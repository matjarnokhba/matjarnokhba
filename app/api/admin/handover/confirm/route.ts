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
    if (!parsed.success) return NextResponse.json({ success: false, message: "رمز غير صحيح" }, { status: 400 });

    const handover = await prisma.adminCashHandover.findUnique({
      where: { handoverToken: parsed.data.token }
    });

    if (!handover || handover.status !== "PENDING") {
      return NextResponse.json({ success: false, message: "الطلب غير صالح أو تم استلامه مسبقاً" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. تحديث حالة التسليم
      await tx.adminCashHandover.update({
        where: { id: handover.id },
        data: { status: "COMPLETED", completedAt: new Date(), adminId: current.user.id }
      });

      // 2. خصم المبلغ من كاش المستودع
      const whWallet = await tx.wallet.findUnique({
        where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: 1 } }
      });
      if (!whWallet || Number(whWallet.cashInHand) < Number(handover.amount)) {
        throw new Error("كاش المستودع لا يكفي لهذه العملية");
      }

      await tx.wallet.update({
        where: { id: whWallet.id },
        data: { cashInHand: { decrement: handover.amount } }
      });

      await tx.walletTransactionUnified.create({
        data: {
          walletId: whWallet.id,
          amount: -Number(handover.amount),
          type: "CASH_HANDOVER",
          description: `تسليم كاش للإدارة (طلب #${handover.id})`,
        }
      });

      // 3. إضافة المبلغ إلى كاش الأدمن (المنصة)
      const platformWallet = await tx.wallet.upsert({
        where: { ownerType_ownerId: { ownerType: "PLATFORM", ownerId: 1 } },
        create: { ownerType: "PLATFORM", ownerId: 1, cashInHand: handover.amount },
        update: { cashInHand: { increment: handover.amount } }
      });

      await tx.walletTransactionUnified.create({
        data: {
          walletId: platformWallet.id,
          amount: handover.amount,
          type: "CASH_RECEIVED",
          description: `استلام كاش من المستودع (طلب #${handover.id})`,
        }
      });
    });

    return NextResponse.json({ success: true, amountReceived: Number(handover.amount) });
  } catch (error) {
    console.error("Handover confirm error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}