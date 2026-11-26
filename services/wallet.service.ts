import { computeClawback } from "@/lib/return-clawback";
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

  const staleHandoverBatches = await tx.refusedHandoverBatch.count({
    where: {
      driverId,
      status: "PENDING",
      createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  const shouldBlock =
    (hasCash && isHeldOver24h) ||
    pendingRefusedOver24h > 0 ||
    staleHandoverBatches > 0;

  let reason: string | null = null;
  if (shouldBlock) {
    if (hasCash && isHeldOver24h) {
      reason = "كاش محتجز لأكثر من 24 ساعة";
    }
    if (pendingRefusedOver24h > 0) {
      reason = "بضاعة مرفوضة منذ أكثر من 24 ساعة لم تُرجع للمستودع";
    }
    if (staleHandoverBatches > 0) {
      reason = "دفعة مرتجعات معلّقة منذ أكثر من 7 أيام";
    }
  }

  if (wallet.isBlocked !== shouldBlock || wallet.blockReason !== reason) {
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { isBlocked: shouldBlock, blockReason: reason },
    });
  }

  // ═══ مزامنة الإنذار القانوني تلقائياً ═══
  try {
    const { LegalNoticeService } = await import("./legal-notice.service");
    await LegalNoticeService.syncForDriver(tx, driverId);
  } catch (e) {
    console.error("Legal notice sync failed:", e);
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

    // منع احتساب أرباح الطلب مرتين (مفتاح فريد في قاعدة البيانات)
    const heldKey = `held:order:${orderId}`;
    const dupHeld = await tx.walletTransaction.findUnique({ where: { idempotencyKey: heldKey } });
    if (dupHeld) return { commissionAmount: 0 };

    const policy = await tx.systemPolicy.findUnique({
      where: { key: "DEFAULT_COMMISSION_RATE" },
    });
    const defaultRate = typeof policy?.value === "number" ? policy.value : 0.1;
    const rate = seller.commissionRateOverride
      ? Number(seller.commissionRateOverride)
      : defaultRate;

    // ═══ دعم المنصة للعروض المحدودة: التاجر يُحاسَب على سعر القائمة ═══
    const flashLines: any[] =
      (await tx.flashSaleOrderLine?.findMany({
        where: { orderItem: { orderId }, settledAt: null, reversedAt: null },
        select: { id: true, platformSubsidy: true },
      })) ?? [];
    const platformSubsidy =
      Math.round(
        flashLines.reduce((s: number, l: any) => s + Number(l.platformSubsidy), 0) * 100
      ) / 100;
    const effectiveSubtotal = Math.round((orderSubtotal + platformSubsidy) * 100) / 100;

    const commissionAmount = Math.round(effectiveSubtotal * rate * 100) / 100;
    const netEarning = Math.round((effectiveSubtotal - commissionAmount) * 100) / 100;
    const platformNetBalance = Math.round((commissionAmount - platformSubsidy) * 100) / 100;
    if (netEarning <= 0) return { commissionAmount: 0 };

    const beforeHeld = Number(seller.heldBalance);
    const afterHeld = beforeHeld + netEarning;

    await tx.seller.update({
      where: { id: sellerId },
      data: {
        heldBalance: { increment: netEarning },
        totalRevenue: { increment: effectiveSubtotal },
        totalCommission: { increment: commissionAmount },
      },
    });

    await tx.walletTransaction.create({
      data: {
        sellerId,
        orderId,
        idempotencyKey: heldKey,
        type: WalletTransactionType.HELD_EARNING,
        amount: netEarning,
        balanceBefore: beforeHeld,
        balanceAfter: afterHeld,
        description: `أرباح محجوزة من الطلب #${orderId} بعد خصم عمولة ${rate * 100}%`,
      },
    });

    // مصدر الحقيقة لأرباح الطلب (تعتمد عليه التقارير وعكس الإرجاع)
    await tx.order.update({
      where: { id: orderId },
      data: { commission: commissionAmount, sellerPayout: netEarning },
    });

    const platformWallet = await tx.wallet.upsert({
      where: { ownerType_ownerId: { ownerType: "PLATFORM", ownerId: PLATFORM_ID } },
      create: {
        ownerType: "PLATFORM",
        ownerId: PLATFORM_ID,
        balance: platformNetBalance,
        heldBalance: netEarning,
      },
      update: {
        balance: { increment: platformNetBalance },
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

    if (platformSubsidy > 0) {
      await tx.walletTransactionUnified.create({
        data: {
          walletId: platformWallet.id,
          amount: -platformSubsidy,
          type: "COMMISSION",
          description: `دعم المنصة لعرض محدود - الطلب #${orderId}`,
        },
      });
    }
    if (flashLines.length > 0) {
      await tx.flashSaleOrderLine.updateMany({
        where: { id: { in: flashLines.map((l: any) => l.id) } },
        data: { settledAt: new Date() },
      });
    }

    return { commissionAmount };
  },

  // ═══ عكس أرباح التاجر عند إكمال إرجاع العميل (ذرّي مع الإرجاع) ═══
  async clawbackReturn(
    tx: any,
    input: {
      returnId: number;
      isFull: boolean;
      order: {
        id: number;
        orderNumber: string;
        sellerId: number | null;
        commission: number | null;
        sellerPayout: number | null;
        refundedCommission: number;
      };
      items: { orderItemId: number; qty: number; orderItemQty: number; unitPrice: number }[];
    }
  ) {
    const { order } = input;
    // لا نخصم أرباحاً لم تُمنح أصلاً (طلبات قبل تسجيل الصافي)
    if (!order.sellerId || order.commission === null || order.sellerPayout === null) {
      return { skipped: "no-earning-record" as const };
    }
    const key = `return:${input.returnId}`;
    const dup = await tx.walletTransaction.findUnique({ where: { idempotencyKey: key } });
    if (dup) return { skipped: "duplicate" as const };

    const lines: any[] =
      (await tx.flashSaleOrderLine?.findMany({
        where: { orderItemId: { in: input.items.map((i) => i.orderItemId) }, reversedAt: null },
        select: { id: true, orderItemId: true, quantity: true, platformSubsidy: true },
      })) ?? [];
    const lineByItem = new Map<number, any>(lines.map((l) => [l.orderItemId, l]));
    const calcItems = input.items.map((i) => {
      const l = lineByItem.get(i.orderItemId);
      const share = l
        ? Math.round(((Number(l.platformSubsidy) * Math.min(i.qty, l.quantity)) / l.quantity) * 100) / 100
        : 0;
      return { unitPrice: i.unitPrice, qty: i.qty, subsidyShare: share };
    });

    const prevAgg = await tx.walletTransaction.aggregate({
      where: { orderId: order.id, type: "REFUND_DEDUCTION" },
      _sum: { amount: true },
    });
    const calc = computeClawback({
      commission: order.commission,
      sellerPayout: order.sellerPayout,
      refundedCommission: order.refundedCommission,
      prevNet: Number(prevAgg?._sum?.amount ?? 0),
      isFull: input.isFull,
      items: calcItems,
    });
    if (calc.netBack <= 0 && calc.commissionBack <= 0) return { skipped: "zero" as const };

    // الرصيد قد يصير سالباً (دين يُسدَّد من التحريرات القادمة)
    const updated = await tx.seller.update({
      where: { id: order.sellerId },
      data: {
        walletBalance: { decrement: calc.netBack },
        totalRevenue: { decrement: Math.round((calc.netBack + calc.commissionBack) * 100) / 100 },
        totalCommission: { decrement: calc.commissionBack },
      },
      select: { walletBalance: true, userId: true },
    });
    const afterBal = Number(updated.walletBalance);
    await tx.walletTransaction.create({
      data: {
        sellerId: order.sellerId,
        orderId: order.id,
        idempotencyKey: key,
        type: "REFUND_DEDUCTION",
        amount: calc.netBack,
        balanceBefore: Math.round((afterBal + calc.netBack) * 100) / 100,
        balanceAfter: afterBal,
        description: `استرداد أرباح إرجاع من الطلب #${order.orderNumber} (إرجاع رقم ${input.returnId})`,
      },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { refundedCommission: { increment: calc.commissionBack } },
    });

    // المنصة: تُلغى العمولة وتسترد الدعم الذي دفعته
    const platformDelta = Math.round((calc.commissionBack - calc.subsidyBack) * 100) / 100;
    const pw = await tx.wallet.upsert({
      where: { ownerType_ownerId: { ownerType: "PLATFORM", ownerId: PLATFORM_ID } },
      create: { ownerType: "PLATFORM", ownerId: PLATFORM_ID, balance: -platformDelta },
      update: { balance: { decrement: platformDelta } },
    });
    await tx.walletTransactionUnified.create({
      data: {
        walletId: pw.id,
        amount: -platformDelta,
        type: "COMMISSION",
        description: `عكس عمولة إرجاع من الطلب #${order.orderNumber}`,
      },
    });

    // بنود العرض المرجعة بالكامل تُعلَّم معكوسة (تخرج من تقرير الدعم)
    const fullIds = input.items
      .filter((i) => i.qty >= i.orderItemQty)
      .map((i) => lineByItem.get(i.orderItemId)?.id)
      .filter((x): x is number => typeof x === "number");
    if (fullIds.length > 0) {
      await tx.flashSaleOrderLine.updateMany({
        where: { id: { in: fullIds } },
        data: { reversedAt: new Date() },
      });
    }

    try {
      const { NotificationService } = await import("./notification.service");
      await NotificationService.create(
        {
          userId: updated.userId,
          type: "RETURN_COMPLETED",
          title: "خصم أرباح بسبب إرجاع",
          message: `أُرجعت قطع من الطلب #${order.orderNumber}، فخُصم ${calc.netBack.toFixed(2)} د.م من أرباحك (وأُلغيت عمولتها). ${afterBal < 0 ? "رصيدك سالب الآن وسيُسدَّد من أرباحك القادمة." : ""}`,
          link: "/seller/wallet",
          category: "WALLET",
          severity: afterBal < 0 ? "WARNING" : "INFO",
          metadata: { orderId: order.id, returnId: input.returnId, netBack: calc.netBack },
        },
        tx
      );
    } catch (e) {
      console.error("return clawback notification failed", e);
    }

    return { skipped: false as const, ...calc };
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

  // ═══ تسوية كلفة شحن المرتجع حسب من يتحملها ═══
  async settleReturnShipping(
    tx: any,
    input: {
      returnId: number;
      orderNumber: string;
      sellerId: number | null;
      payer: "CUSTOMER" | "SELLER" | "PLATFORM" | "NONE";
      fee: number;
    }
  ) {
    const { returnId, orderNumber, fee } = input;
    if (fee <= 0 || input.payer === "NONE") return { skipped: true as const };

    // المستودع يستلم كلفة النقل دائماً
    const warehouseWallet = await tx.wallet.upsert({
      where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: WAREHOUSE_ID } },
      create: { ownerType: "WAREHOUSE", ownerId: WAREHOUSE_ID, balance: fee },
      update: { balance: { increment: fee } },
    });
    await tx.walletTransactionUnified.create({
      data: {
        walletId: warehouseWallet.id,
        amount: fee,
        type: "RETURN_FEE",
        description: `كلفة شحن مرتجع من الطلب #${orderNumber}`,
        referenceId: String(returnId),
      },
    });

    // الزبون: خُصمت من مبلغ الاسترداد في ReturnService، لا شيء آخر
    if (input.payer === "CUSTOMER") return { skipped: false as const, payer: "CUSTOMER" as const };

    // التاجر: خصم من رصيده (قد يصير سالباً = دين)
    if (input.payer === "SELLER" && input.sellerId) {
      const key = `retship:${returnId}`;
      const dup = await tx.walletTransaction.findUnique({ where: { idempotencyKey: key } });
      if (dup) return { skipped: true as const };
      const upd = await tx.seller.update({
        where: { id: input.sellerId },
        data: { walletBalance: { decrement: fee } },
        select: { walletBalance: true, userId: true },
      });
      const after = Number(upd.walletBalance);
      await tx.walletTransaction.create({
        data: {
          sellerId: input.sellerId,
          idempotencyKey: key,
          type: "MANUAL_ADJUSTMENT",
          amount: -fee,
          balanceBefore: Math.round((after + fee) * 100) / 100,
          balanceAfter: after,
          description: `كلفة شحن مرتجع من الطلب #${orderNumber} (إرجاع رقم ${returnId})`,
        },
      });
      try {
        const { NotificationService } = await import("./notification.service");
        await NotificationService.create(
          {
            userId: upd.userId,
            type: "RETURN_COMPLETED",
            title: "خصم كلفة شحن مرتجع",
            message: `خُصمت كلفة شحن المرتجع (${fee.toFixed(2)} د.م) من رصيدك للطلب #${orderNumber}.`,
            link: "/seller/wallet",
            category: "WALLET",
            severity: "WARNING",
            metadata: { returnId, fee },
          },
          tx
        );
      } catch (e) {
        console.error("return shipping notification failed", e);
      }
      return { skipped: false as const, payer: "SELLER" as const };
    }

    // المنصة (أو تاجر غير معروف): تتحمل من محفظتها
    const pw = await tx.wallet.upsert({
      where: { ownerType_ownerId: { ownerType: "PLATFORM", ownerId: PLATFORM_ID } },
      create: { ownerType: "PLATFORM", ownerId: PLATFORM_ID, balance: -fee },
      update: { balance: { decrement: fee } },
    });
    await tx.walletTransactionUnified.create({
      data: {
        walletId: pw.id,
        amount: -fee,
        type: "RETURN_FEE",
        description: `المنصة تتحمل شحن مرتجع الطلب #${orderNumber}`,
        referenceId: String(returnId),
      },
    });
    return { skipped: false as const, payer: "PLATFORM" as const };
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