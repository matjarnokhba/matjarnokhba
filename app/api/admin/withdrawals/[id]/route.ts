import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { WalletTransactionType } from "@/app/generated/prisma/enums";

const schema = z.object({
  status: z.enum(["PAID", "REJECTED"]),
  adminNote: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const withdrawalId = Number.parseInt(id, 10);
    if (!Number.isInteger(withdrawalId) || withdrawalId <= 0) {
      return NextResponse.json({ success: false, message: "معرّف غير صحيح" }, { status: 400 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });
    }
    const { status, adminNote } = parsed.data;

    await prisma.$transaction(async (tx) => {
      // 1. claim ذري: ينجح طلب واحد فقط مهما تزامنت الطلبات
      const claim = await tx.withdrawalRequest.updateMany({
        where: { id: withdrawalId, status: "PENDING" },
        data: { status, adminNote: adminNote || null, processedAt: new Date() },
      });
      if (claim.count !== 1) throw new Error("الطلب غير موجود أو تمت معالجته مسبقاً");

      const req = await tx.withdrawalRequest.findUnique({
        where: { id: withdrawalId },
        include: { seller: true },
      });
      if (!req) throw new Error("الطلب غير موجود");

      if (status === "REJECTED") {
        // إرجاع المبلغ لمحفظة التاجر
        const updatedSeller = await tx.seller.update({
          where: { id: req.seller.id },
          data: { walletBalance: { increment: req.amount } },
          select: { walletBalance: true },
        });
        const afterBal = Number(updatedSeller.walletBalance);
        const beforeBal = afterBal - Number(req.amount);

        await tx.walletTransaction.create({
          data: {
            sellerId: req.seller.id,
            type: WalletTransactionType.MANUAL_ADJUSTMENT,
            amount: req.amount,
            balanceBefore: beforeBal,
            balanceAfter: afterBal,
            description: `إرجاع مبلغ السحب المرفوض #${req.id} - ${adminNote || ""}`,
          },
        });
      } else {
        // خصم من محفظة المنصة بشرط كفاية الرصيد (ذرياً)
        const platformWallet = await tx.wallet.findUnique({
          where: { ownerType_ownerId: { ownerType: "PLATFORM", ownerId: 1 } },
        });
        if (!platformWallet) throw new Error("محفظة المنصة غير موجودة");

        const debit = await tx.wallet.updateMany({
          where: { id: platformWallet.id, balance: { gte: req.amount } },
          data: { balance: { decrement: req.amount } },
        });
        if (debit.count !== 1) {
          throw new Error("رصيد محفظة المنصة غير كافٍ لدفع مستحقات التاجر.");
        }

        await tx.walletTransactionUnified.create({
          data: {
            walletId: platformWallet.id,
            amount: -Number(req.amount),
            type: "PAYOUT",
            description: `دفع مستحقات للتاجر: ${req.seller.storeName} (طلب سحب #${req.id})`,
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}