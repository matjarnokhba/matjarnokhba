import { describe, it, expect } from "vitest";
import { resolveReturnShippingFee, DEFAULT_RETURN_FEE } from "../lib/return-policy";

describe("resolveReturnShippingFee", () => {
  it("تعديل الأدمن يغلب كل شيء", () => {
    expect(resolveReturnShippingFee({ override: 12.5, orderShipping: 20, policyDefault: 30 })).toBe(12.5);
  });
  it("بلا تعديل: سعر شحن الطلب الأصلي", () => {
    expect(resolveReturnShippingFee({ override: 0, orderShipping: 20, policyDefault: 30 })).toBe(20);
  });
  it("شحن مجاني: القيمة الافتراضية من الإعدادات", () => {
    expect(resolveReturnShippingFee({ override: 0, orderShipping: 0, policyDefault: 25 })).toBe(25);
  });
  it("لا إعدادات: 20", () => {
    expect(resolveReturnShippingFee({ override: 0, orderShipping: 0, policyDefault: null })).toBe(DEFAULT_RETURN_FEE);
    expect(DEFAULT_RETURN_FEE).toBe(20);
  });
});