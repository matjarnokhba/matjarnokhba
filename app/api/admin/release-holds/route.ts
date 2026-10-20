import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { WalletTransactionType } from "@/app/generated/prisma/enums";

export async function POST() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const heldTransactions = await prisma.walletTransaction.findMany({
      where: {
        type: WalletTransactionType.HELD_EARNING,
        createdAt: { lte: threeDaysAgo },
        // نتحقق أن لم يتم تحريره سابقاً (عن طريق البحث عن حركة تحرير بنفس الوصف)
      }
    });

    let releasedCount = 0;

    for (const txRecord of heldTransactions) {
      // التحقق مما إذا كان قد تم تحريره بالفعل
      const alreadyReleased = await prisma.walletTransaction.findFirst({
        where: {
          sellerId: txRecord.sellerId,
          type: WalletTransactionType.RELEASE_HOLD,
          description: { contains: txRecord.id.toString() }
        }
      });

      if (alreadyReleased) continue;

      await prisma.$transaction(async (tx) => {
        const seller = await tx.seller.findUnique({ where: { id: txRecord.sellerId } });
        if (!seller) return;

        const beforeBal = Number(seller.walletBalance);
        const afterBal = beforeBal + Number(txRecord.amount);

        await tx.seller.update({
          where: { id: seller.id },
          data: {
            walletBalance: { increment: txRecord.amount },
            heldBalance: { decrement: txRecord.amount },
          }
        });

        await tx.walletTransaction.create({
          data: {
            sellerId: seller.id,
            type: WalletTransactionType.RELEASE_HOLD,
            amount: txRecord.amount,
            balanceBefore: beforeBal,
            balanceAfter: afterBal,
            description: `تحرير أرباح محجوزة (مرجع حركة رقم ${txRecord.id})`
          }
        });
      });
      releasedCount++;
    }

    return NextResponse.json({ success: true, releasedCount });
  } catch (error) {
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}