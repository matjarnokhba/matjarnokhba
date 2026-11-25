import { describe, it, expect } from "vitest";
import { reasonTypeLabel, payerLabelForCustomer, payerLabelForSeller, deadlineBadge } from "./return-labels";

describe("return labels", () => {
  it("reasonTypeLabel: معروف", () => expect(reasonTypeLabel("DEFECTIVE")).toBe("منتج معيب أو مكسور"));
  it("reasonTypeLabel: مجهول أو فارغ", () => {
    expect(reasonTypeLabel("XYZ")).toBe("");
    expect(reasonTypeLabel(null)).toBe("");
  });
  it("العميل يدفع: يظهر المبلغ", () => expect(payerLabelForCustomer("CUSTOMER", "20.00")).toContain("20"));
  it("التاجر يتكفل: مجاني للعميل", () => expect(payerLabelForCustomer("SELLER", 20)).toContain("مجاني"));
  it("بطاقة مجانية: تُذكر", () => expect(payerLabelForCustomer("PLATFORM", 20)).toContain("بطاقة"));
  it("بلا قيمة: نص فارغ", () => expect(payerLabelForCustomer(null, 0)).toBe(""));
  it("التاجر يدفع: المبلغ وخصم المحفظة", () => {
    const s = payerLabelForSeller("SELLER", "20.00");
    expect(s).toContain("عليك");
    expect(s).toContain("20");
  });
  it("العميل يدفع: يراه التاجر", () => expect(payerLabelForSeller("CUSTOMER", 20)).toBe("الشحن على العميل"));
  it("deadlineBadge: فارغ", () => expect(deadlineBadge(null)).toBeNull());
  it("deadlineBadge: متجاوز", () => {
    const now = Date.parse("2026-11-25T12:00:00Z");
    expect(deadlineBadge("2026-11-25T10:00:00Z", now)?.overdue).toBe(true);
  });
  it("deadlineBadge: متبقٍ 5 ساعات", () => {
    const now = Date.parse("2026-11-25T12:00:00Z");
    const b = deadlineBadge("2026-11-25T17:00:00Z", now);
    expect(b?.overdue).toBe(false);
    expect(b?.label).toContain("5");
  });
});