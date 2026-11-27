export const TRANSFER_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PENDING_APPROVAL", "PREPARED", "CANCELLED"],
  PENDING_APPROVAL: ["PREPARED", "CANCELLED"],
  PREPARED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["RECEIVED", "RECEIVED_WITH_DISCREPANCY"],
  RECEIVED: ["CLOSED"],
  RECEIVED_WITH_DISCREPANCY: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

/** حالات عناصر التجهيز التي تكون فيها الطرود فعلاً داخل المستودع وغير مخصصة لشحنة. */
export const TRANSFERABLE_ITEM_STATUSES = ["RECEIVED", "VERIFIED", "AVAILABLE_FOR_SHIPMENT"];

export const SOURCE_ROLES = ["MANAGER", "SHIPMENT_PREPARER"];
export const DEST_ROLES = ["MANAGER", "RECEIVER"];

export function canTransferTransition(from: string, to: string): boolean {
  return (TRANSFER_TRANSITIONS[from] ?? []).includes(to);
}

export type ReceiptOutcome = "RECEIVED" | "PARTIAL" | "DAMAGED" | "MISSING";

export type ReceiptEvaluation =
  | {
      ok: true;
      outcome: ReceiptOutcome;
      receivedQuantity: number;
      discrepancy: null | { type: "MISSING" | "DAMAGED" | "QUANTITY_MISMATCH"; expectedQty: number; actualQty: number };
    }
  | { ok: false; message: string };

export function evaluateReceipt(expected: number, outcome: ReceiptOutcome, receivedQty?: number): ReceiptEvaluation {
  if (outcome === "RECEIVED") return { ok: true, outcome, receivedQuantity: expected, discrepancy: null };
  if (outcome === "MISSING") {
    return { ok: true, outcome, receivedQuantity: 0, discrepancy: { type: "MISSING", expectedQty: expected, actualQty: 0 } };
  }
  if (outcome === "DAMAGED") {
    return { ok: true, outcome, receivedQuantity: expected, discrepancy: { type: "DAMAGED", expectedQty: expected, actualQty: expected } };
  }
  if (!Number.isInteger(receivedQty) || (receivedQty as number) < 1 || (receivedQty as number) >= expected) {
    return { ok: false, message: "الكمية الجزئية يجب أن تكون أكبر من 0 وأقل من الكمية المتوقعة (" + expected + ")" };
  }
  return {
    ok: true,
    outcome,
    receivedQuantity: receivedQty as number,
    discrepancy: { type: "QUANTITY_MISMATCH", expectedQty: expected, actualQty: receivedQty as number },
  };
}