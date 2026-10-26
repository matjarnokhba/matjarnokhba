import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { WalletTransactionType } from "@/app/generated/prisma/enums";
import { requireSellerOwner } from "@/lib/seller-guards";

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
    const guard = await requireSellerOwner();
    if (!guard.ok) return guard.response;
    const current = guard.current;

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const { amount, bankDetails } = parsed.data;
    const sellerId = current.user.seller!.id;

    const result = await prisma.$transaction(async (tx) => {
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

      const seller = await tx.seller.findUnique({
        where: { id: sellerId },
        select: { walletBalance: true },
      });

      const afterBal = Number(seller!.walletBalance);
      const beforeBal = afterBal + amount;

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