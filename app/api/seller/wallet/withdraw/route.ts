import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { WalletTransactionType } from "@/app/generated/prisma/enums";

const schema = z.object({
  amount: z.number().positive(),
  bankDetails: z.object({
    method: z.string(),
    accountName: z.string().min(2),
    accountNumber: z.string().min(5),
    bankName: z.string().optional(),
  }),
});

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });
    }

    const { amount, bankDetails } = parsed.data;
    const sellerId = current.user.seller.id;

    const result = await prisma.$transaction(async (tx) => {
      // ✅ ذري: خصم مشروط بالرصيد الكافي — يمنع السحب المتزامن الزائد
      const claimed = await tx.seller.updateMany({
        where: {
          id: sellerId,
          walletBalance: { gte: amount },
        },
        data: { walletBalance: { decrement: amount } },
      });

      if (claimed.count === 0) {
        throw new Error("رصيدك المتاح لا يكفي لطلب السحب");
      }

      // قراءة الرصيد الفعلي بعد الخصم للسجل المحاسبي
      const seller = await tx.seller.findUnique({
        where: { id: sellerId },
        select: { walletBalance: true },
      });

      const afterBal = Number(seller!.walletBalance);
      const beforeBal = afterBal + amount;

      // تسجيل الحركة
      await tx.walletTransaction.create({
        data: {
          sellerId,
          type: WalletTransactionType.WITHDRAWAL,
          amount: -amount,
          balanceBefore: beforeBal,
          balanceAfter: afterBal,
          description: "طلب سحب - قيد المراجعة (يُحول كل يوم سبت)",
        },
      });

      // إنشاء طلب السحب
      const req = await tx.withdrawalRequest.create({
        data: {
          sellerId,
          amount,
          bankDetails,
          status: "PENDING",
        },
      });

      return req;
    });

    return NextResponse.json({ success: true, request: result });

  } catch (error) {
    console.error("Withdrawal POST error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}