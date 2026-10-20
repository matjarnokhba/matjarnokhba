import { prisma } from "@/lib/prisma";
import { WalletTransactionType } from "@/app/generated/prisma/enums";

export const WalletService = {
  // إضافة أرباح محجوزة عند التسليم
  async addHeldEarning(tx: any, sellerId: number, orderId: number, orderTotal: number) {
    const seller = await tx.seller.findUnique({
      where: { id: sellerId },
      select: { commissionRateOverride: true, heldBalance: true },
    });

    if (!seller) return;

    // نسبة العمولة: 10% افتراضياً، أو النسبة المخصصة لكل تاجر
    const rate = seller.commissionRateOverride ? Number(seller.commissionRateOverride) : 0.10;
    const commissionAmount = Math.round(orderTotal * rate * 100) / 100;
    const netEarning = Math.round((orderTotal - commissionAmount) * 100) / 100;

    if (netEarning <= 0) return;

    const beforeHeld = Number(seller.heldBalance);
    const afterHeld = beforeHeld + netEarning;

    // 1. تحديث محفظة التاجر وإجمالياته
    await tx.seller.update({
      where: { id: sellerId },
      data: {
        heldBalance: { increment: netEarning },
        totalRevenue: { increment: orderTotal },
        totalCommission: { increment: commissionAmount },
      },
    });

    // 2. تسجيل الحركة في المحفظة
    await tx.walletTransaction.create({
      data: {
        sellerId,
        type: WalletTransactionType.HELD_EARNING,
        amount: netEarning,
        balanceBefore: beforeHeld,
        balanceAfter: afterHeld,
        description: `أرباح محجوزة (ضمان 3 أيام) من الطلب #${orderId} بعد خصم عمولة ${rate * 100}%`,
      },
    });
  },
};