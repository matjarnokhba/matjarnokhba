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