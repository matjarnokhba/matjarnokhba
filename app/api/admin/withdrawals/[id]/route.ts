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
    const withdrawalId = parseInt(id);
    const body = await request.json();
    const parsed = schema.safeParse(body);
    
    if (!parsed.success) return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });

    const { status, adminNote } = parsed.data;

    await prisma.$transaction(async (tx) => {
      const req = await tx.withdrawalRequest.findUnique({
        where: { id: withdrawalId },
        include: { seller: true }
      });

      if (!req || req.status !== "PENDING") throw new Error("الطلب غير موجود أو تمت معالجته مسبقاً");

      // تحديث حالة الطلب
      await tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: { status, adminNote: adminNote || null, processedAt: new Date() }
      });

      // إذا تم الرفض، نرجع المبلغ للمحفظة
      if (status === "REJECTED") {
        const seller = req.seller;
        const beforeBal = Number(seller.walletBalance);
        const afterBal = beforeBal + Number(req.amount);

        await tx.seller.update({
          where: { id: seller.id },
          data: { walletBalance: { increment: req.amount } }
        });

        await tx.walletTransaction.create({
          data: {
            sellerId: seller.id,
            type: WalletTransactionType.MANUAL_ADJUSTMENT,
            amount: req.amount,
            balanceBefore: beforeBal,
            balanceAfter: afterBal,
            description: `إرجاع مبلغ السحب المرفوض #${req.id} - ${adminNote || ""}`
          }
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}