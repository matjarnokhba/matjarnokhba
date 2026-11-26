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