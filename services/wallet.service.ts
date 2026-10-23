import { prisma } from "@/lib/prisma";
import { WalletTransactionType } from "@/app/generated/prisma/enums";

const DRIVER_FEE = 13; // أجر السائق لكل توصيل
const PLATFORM_ID = 1; // معرف محفظة المنصة
const WAREHOUSE_ID = 1; // معرف محفظة المستودع

export const WalletService = {
  // ═══ 1. إضافة أرباح محجوزة للتاجر عند التسليم (وتسجيل أمانات المنصة) ═══
  async addHeldEarning(tx: any, sellerId: number, orderId: number, orderTotal: number, orderSubtotal: number) {
    const seller = await tx.seller.findUnique({
      where: { id: sellerId },
      select: { commissionRateOverride: true, heldBalance: true },
    });
    if (!seller) return { commissionAmount: 0 };

    const policy = await tx.systemPolicy.findUnique({ where: { key: "DEFAULT_COMMISSION_RATE" } });
    const defaultRate = typeof policy?.value === "number" ? policy.value : 0.10;
    const rate = seller.commissionRateOverride ? Number(seller.commissionRateOverride) : defaultRate;
    
    const commissionAmount = Math.round(orderSubtotal * rate * 100) / 100;
    const netEarning = Math.round((orderSubtotal - commissionAmount) * 100) / 100;

    if (netEarning <= 0) return { commissionAmount: 0 };

    // أ. تحديث محفظة التاجر (رصيد محجوز)
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
        description: `أرباح محجوزة (ضمان 3 أيام) من الطلب #${orderId} بعد خصم عمولة ${rate * 100}%`,
      },
    });

    // ب. تحديث محفظة المنصة (أرباح + أمانات التجار)
    const platformWallet = await tx.wallet.upsert({
      where: { ownerType_ownerId: { ownerType: "PLATFORM", ownerId: PLATFORM_ID } },
      create: { ownerType: "PLATFORM", ownerId: PLATFORM_ID, balance: commissionAmount, heldBalance: netEarning },
      update: { balance: { increment: commissionAmount }, heldBalance: { increment: netEarning } }
    });
    
    await tx.walletTransactionUnified.create({
      data: {
        walletId: platformWallet.id,
        amount: commissionAmount,
        type: "COMMISSION",
        description: `عمولة المنصة من الطلب #${orderId}`,
      }
    });

    return { commissionAmount };
  },

  // ═══ 2. توزيع أرباح السائق والمستودع (وتسجيل الكاش في حوزة السائق) ═══
  async processDeliveryFinancials(tx: any, order: any, driverId: number) {
    // أ. السائق: استحقاق 13 درهم + كاش في الحوزة (total) + حظر
    const driverWallet = await tx.wallet.upsert({
      where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: driverId } },
      create: { ownerType: "DRIVER", ownerId: driverId, balance: DRIVER_FEE, cashInHand: order.total, isBlocked: true },
      update: { balance: { increment: DRIVER_FEE }, cashInHand: { increment: order.total }, isBlocked: true }
    });
    
    await tx.walletTransactionUnified.create({
      data: {
        walletId: driverWallet.id,
        amount: DRIVER_FEE,
        type: "EARNING",
        description: `أجر توصيل الطلب #${order.orderNumber}`,
        referenceId: String(order.id)
      }
    });

    // ب. المستودع: استحقاق 7 دراهم (بدون كاش في الحوزة بعد، يأتي عند التحصيل)
    const warehouseProfit = Math.max(0, Number(order.shippingCost || 0) - DRIVER_FEE);
    if (warehouseProfit > 0) {
      const warehouseWallet = await tx.wallet.upsert({
        where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: WAREHOUSE_ID } },
        create: { ownerType: "WAREHOUSE", ownerId: WAREHOUSE_ID, balance: warehouseProfit },
        update: { balance: { increment: warehouseProfit } }
      });
      await tx.walletTransactionUnified.create({
        data: {
          walletId: warehouseWallet.id,
          amount: warehouseProfit,
          type: "SHIPPING_PROFIT",
          description: `أرباح شحن من الطلب #${order.orderNumber}`,
          referenceId: String(order.id)
        }
      });
    }
  },

  // ═══ 3. إضافة رسوم الإرجاع (15 درهم) لمحفظة المستودع ═══
  async processReturnFee(tx: any, returnId: number, orderNumber: string) {
    const RETURN_FEE = 15;
    const warehouseWallet = await tx.wallet.upsert({
      where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: WAREHOUSE_ID } },
      create: { ownerType: "WAREHOUSE", ownerId: WAREHOUSE_ID, balance: RETURN_FEE },
      update: { balance: { increment: RETURN_FEE } }
    });
    await tx.walletTransactionUnified.create({
      data: {
        walletId: warehouseWallet.id,
        amount: RETURN_FEE,
        type: "RETURN_FEE",
        description: `رسوم إرجاع من الطلب #${orderNumber}`,
        referenceId: String(returnId)
      }
    });
  }
};