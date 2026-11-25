// تفصيل الأرباح الصافية للتاجر + تصحيح إشارة العرض.
// تنبيه: البادئتان أدناه مطابقتان لوصف الحركات التي تكتبها wallet.service و admin/withdrawals.
export const RETURN_SHIPPING_PREFIX = "كلفة شحن مرتجع";
export const REJECTED_WITHDRAWAL_PREFIX = "إرجاع مبلغ السحب المرفوض";

export type WalletSummary = {
  grossSales: number;
  commission: number;
  netEarnings: number;
  refundsDeducted: number;
  returnShipping: number;
  subscriptions: number;
  withdrawn: number;
  netAfterCosts: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
};

// REFUND_DEDUCTION يُخزَّن موجباً لكنه خصم فعلي من رصيد التاجر
export function displayAmount(type: string, amount: number | string): number {
  const n = num(amount);
  return type === "REFUND_DEDUCTION" ? -Math.abs(n) : n;
}

export function buildWalletSummary(input: {
  totalRevenue: number;
  totalCommission: number;
  refundDeductionSum: number;
  returnShippingSum: number;
  subscriptionSum: number;
  withdrawalSum: number;
  rejectedWithdrawalSum: number;
}): WalletSummary {
  const grossSales = r2(num(input.totalRevenue));
  const commission = r2(num(input.totalCommission));
  const netEarnings = r2(grossSales - commission);
  const returnShipping = r2(Math.abs(num(input.returnShippingSum)));
  const subscriptions = r2(Math.abs(num(input.subscriptionSum)));
  const withdrawn = r2(Math.max(0, Math.abs(num(input.withdrawalSum)) - num(input.rejectedWithdrawalSum)));
  return {
    grossSales,
    commission,
    netEarnings,
    refundsDeducted: r2(Math.abs(num(input.refundDeductionSum))),
    returnShipping,
    subscriptions,
    withdrawn,
    netAfterCosts: r2(netEarnings - returnShipping - subscriptions),
  };
}