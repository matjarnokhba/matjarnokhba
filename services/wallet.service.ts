import { prisma } from "@/lib/prisma";
import { WalletTransactionType } from "@/app/generated/prisma/enums";

const DRIVER_FEE = 13;
const PLATFORM_ID = 1;
const WAREHOUSE_ID = 1;

// ═══ دالة تحديث حظر السائق (فقط بعد 24 ساعة أو بضاعة معلقة) ═══
export async function updateDriverBlockStatus(tx: any, driverId: number) {
  const wallet = await tx.wallet.findUnique({
    where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: driverId } },
  });
  if (!wallet) return;

  const hasCash = Number(wallet.cashInHand) > 0;
  const cashHeldSince = wallet.cashHeldSince as Date | null;
  const isHeldOver24h = cashHeldSince
    ? Date.now() - new Date(cashHeldSince).getTime() > 24 * 60 * 60 * 1000
    : false;

  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const pendingRefusedOver24h = await tx.shipmentItem.count({
    where: {
      shipment: { deliveryPersonId: driverId },
      refusedAt: { not: null, lt: cutoff24h },
      returnedToWarehouseAt: null,
    },
  });

  const shouldBlock = (hasCash && isHeldOver24h) || pendingRefusedOver24h > 0;

  let reason: string | null = null;
  if (shouldBlock) {
    if (hasCash && isHeldOver24h) {
      reason = "كاش محتجز لأكثر من 24 ساعة";
    }
    if (pendingRefusedOver24h > 0) {
      reason = "بضاعة مرفوضة منذ أكثر من 24 ساعة لم تُرجع للمستودع";
    }
  }

  if (wallet.isBlocked !== shouldBlock || wallet.blockReason !== reason) {
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { isBlocked: shouldBlock, blockReason: reason },
    });
  }
}

export const WalletService = {
  // ═══ إضافة أرباح محجوزة للتاجر ═══
  async addHeldEarning(
    tx: any,
    sellerId: number,
    orderId: number,
    orderTotal: number,
    orderSubtotal: number
  ) {
    const seller = await tx.seller.findUnique({
      where: { id: sellerId },
      select: { commissionRateOverride: true, heldBalance: true },
    });
    if (!seller) return { commissionAmount: 0 };

    const policy = await tx.systemPolicy.findUnique({
      where: { key: "DEFAULT_COMMISSION_RATE" },
    });
    const defaultRate = typeof policy?.value === "number" ? policy.value : 0.1;
    const rate = seller.commissionRateOverride
      ? Number(seller.commissionRateOverride)
      : defaultRate;

    const commissionAmount = Math.round(orderSubtotal * rate * 100) / 100;
    const netEarning = Math.round((orderSubtotal - commissionAmount) * 100) / 100;
    if (netEarning <= 0) return { commissionAmount: 0 };

    const beforeHeld = Number(seller.heldBalance);
    const afterHeld = beforeHeld + netEarning;

    await tx.seller.update({
      where: { id: sellerId },
      data: {
        heldBalance: { increment: netEarning },
        totalRevenue: { increment: orderSubtotal },
        totalCommission: { increment: commissionAmount },
      },
    });

    await tx.walletTransaction.create({
      data: {
        sellerId,
        type: WalletTransactionType.HELD_EARNING,
        amount: netEarning,
        balanceBefore: beforeHeld,
        balanceAfter: afterHeld,
        description: `أرباح محجوزة من الطلب #${orderId} بعد خصم عمولة ${rate * 100}%`,
      },
    });

    const platformWallet = await tx.wallet.upsert({
      where: { ownerType_ownerId: { ownerType: "PLATFORM", ownerId: PLATFORM_ID } },
      create: {
        ownerType: "PLATFORM",
        ownerId: PLATFORM_ID,
        balance: commissionAmount,
        heldBalance: netEarning,
      },
      update: {
        balance: { increment: commissionAmount },
        heldBalance: { increment: netEarning },
      },
    });

    await tx.walletTransactionUnified.create({
      data: {
        walletId: platformWallet.id,
        amount: commissionAmount,
        type: "COMMISSION",
        description: `عمولة المنصة من الطلب #${orderId}`,
      },
    });

    return { commissionAmount };
  },

  // ═══ توزيع أرباح السائق والمستودع ═══
  async processDeliveryFinancials(tx: any, order: any, driverId: number) {
    // جلب حالة الكاش قبل التحديث (لكي نعرف إن كان صفر ثم صار موجباً)
    const existingDriverWallet = await tx.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: driverId } },
      select: { cashInHand: true },
    });
    const wasCashZero =
      !existingDriverWallet || Number(existingDriverWallet.cashInHand) === 0;

    const driverWallet = await tx.wallet.upsert({
      where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: driverId } },
      create: {
        ownerType: "DRIVER",
        ownerId: driverId,
        balance: DRIVER_FEE,
        cashInHand: order.total,
        cashHeldSince: new Date(), // بدأ يمسك الكاش الآن
      },
      update: {
        balance: { increment: DRIVER_FEE },
        cashInHand: { increment: order.total },
        // إذا كان صفراً وبدأ الآن، نسجل التاريخ
        ...(wasCashZero && { cashHeldSince: new Date() }),
      },
    });

    await tx.walletTransactionUnified.create({
      data: {
        walletId: driverWallet.id,
        amount: DRIVER_FEE,
        type: "EARNING",
        description: `أجر توصيل الطلب #${order.orderNumber}`,
        referenceId: String(order.id),
      },
    });

    const warehouseProfit = Math.max(
      0,
      Number(order.shippingCost || 0) - DRIVER_FEE
    );
    if (warehouseProfit > 0) {
      const warehouseWallet = await tx.wallet.upsert({
        where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: WAREHOUSE_ID } },
        create: { ownerType: "WAREHOUSE", ownerId: WAREHOUSE_ID, balance: warehouseProfit },
        update: { balance: { increment: warehouseProfit } },
      });
      await tx.walletTransactionUnified.create({
        data: {
          walletId: warehouseWallet.id,
          amount: warehouseProfit,
          type: "SHIPPING_PROFIT",
          description: `أرباح شحن من الطلب #${order.orderNumber}`,
          referenceId: String(order.id),
        },
      });
    }
  },

  // ═══ رسوم الإرجاع ═══
  async processReturnFee(tx: any, returnId: number, orderNumber: string) {
    const RETURN_FEE = 15;
    const warehouseWallet = await tx.wallet.upsert({
      where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: WAREHOUSE_ID } },
      create: { ownerType: "WAREHOUSE", ownerId: WAREHOUSE_ID, balance: RETURN_FEE },
      update: { balance: { increment: RETURN_FEE } },
    });
    await tx.walletTransactionUnified.create({
      data: {
        walletId: warehouseWallet.id,
        amount: RETURN_FEE,
        type: "RETURN_FEE",
        description: `رسوم إرجاع من الطلب #${orderNumber}`,
        referenceId: String(returnId),
      },
    });
  },
};