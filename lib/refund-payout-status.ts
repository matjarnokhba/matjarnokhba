export type PayoutStatus = "PROCESSING" | "SENT" | "COMPLETED";
export type PayoutAction = "mark_sent" | "complete";

export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  PROCESSING: "قيد المعالجة",
  SENT: "تم إرسال المبلغ",
  COMPLETED: "مكتمل",
};

export const PAYOUT_METHOD_LABEL: Record<string, string> = {
  BANK: "تحويل بنكي",
  CASH_PLUS: "Cash Plus",
  WAFACASH: "Wafacash",
};

// الانتقال الوحيد المسموح: PROCESSING → SENT → COMPLETED
export function nextPayoutStatus(current: string, action: PayoutAction): PayoutStatus | null {
  if (action === "mark_sent" && current === "PROCESSING") return "SENT";
  if (action === "complete" && current === "SENT") return "COMPLETED";
  return null;
}

export const REFUND_METHOD_LABEL: Record<string, string> = {
  WALLET: "رصيد في المحفظة",
  COUPON: "قسيمة شراء",
  BANK: "تحويل بنكي",
  CASH_PLUS: "Cash Plus",
  WAFACASH: "Wafacash",
};

export function refundMethodLabel(m?: string | null): string {
  if (!m) return "";
  return REFUND_METHOD_LABEL[m] ?? m;
}

export function payoutStatusLabel(s: string): string {
  return (PAYOUT_STATUS_LABEL as Record<string, string>)[s] ?? s;
}
