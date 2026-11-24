// سياسة شحن المرتجع حسب سبب الإرجاع

export const REASON_TYPES = ["DEFECTIVE", "WRONG_ITEM", "MISSING_ITEM", "LOST", "CHANGED_MIND"] as const;
export type ReasonType = (typeof REASON_TYPES)[number];

// أسباب خطأ التاجر/الشحن: تتطلب دليلاً ولا تستهلك البطاقة
export function isSellerFault(r: string): boolean {
  return r === "DEFECTIVE" || r === "WRONG_ITEM" || r === "MISSING_ITEM" || r === "LOST";
}

export function decideReturnShipping(i: { reasonType: string; hasCard: boolean; fee: number }): {
  payer: "CUSTOMER" | "SELLER" | "PLATFORM";
  fee: number;
  customerPays: number;
} {
  if (isSellerFault(i.reasonType)) return { payer: "SELLER", fee: i.fee, customerPays: 0 };
  if (i.hasCard) return { payer: "PLATFORM", fee: i.fee, customerPays: 0 };
  return { payer: "CUSTOMER", fee: i.fee, customerPays: i.fee };
}

export const DEFAULT_RETURN_FEE = 20;
const r2 = (n: number) => Math.round(n * 100) / 100;

// رسوم شحن المرتجع: تعديل الأدمن لهذا الإرجاع ← سعر شحن الطلب الأصلي ← القيمة الافتراضية من الإعدادات
export function resolveReturnShippingFee(i: {
  override: number;
  orderShipping: number;
  policyDefault: number | null;
}): number {
  if (i.override > 0) return r2(i.override);
  if (i.orderShipping > 0) return r2(i.orderShipping);
  if (i.policyDefault !== null && i.policyDefault >= 0) return r2(i.policyDefault);
  return DEFAULT_RETURN_FEE;
}