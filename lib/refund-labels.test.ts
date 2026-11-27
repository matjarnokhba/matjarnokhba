import { describe, it, expect } from "vitest";
import { refundMethodLabel, payoutStatusLabel } from "./refund-payout-status";

describe("refund labels", () => {
  it("labels refund methods in Arabic", () => {
    expect(refundMethodLabel("WALLET")).toBe("رصيد في المحفظة");
    expect(refundMethodLabel("BANK")).toBe("تحويل بنكي");
    expect(refundMethodLabel("CASH_PLUS")).toBe("Cash Plus");
    expect(refundMethodLabel(null)).toBe("");
    expect(refundMethodLabel("X")).toBe("X");
  });
  it("labels payout statuses", () => {
    expect(payoutStatusLabel("PROCESSING")).toBe("قيد المعالجة");
    expect(payoutStatusLabel("SENT")).toBe("تم إرسال المبلغ");
    expect(payoutStatusLabel("COMPLETED")).toBe("مكتمل");
  });
});