import { describe, it, expect } from "vitest";
import {
  normalizeRib,
  isValidRib,
  maskRib,
  maskName,
  validatePayoutDetails,
} from "./refund-payout";

const RIB = "007780000123456789012345";

describe("refund payout", () => {
  it("normalizes RIB (spaces, dashes, arabic digits)", () => {
    expect(normalizeRib("007 780-0001 23456789012345")).toBe(RIB);
    expect(normalizeRib("٠٠٧٧٨٠٠٠٠١٢٣٤٥٦٧٨٩٠١٢٣٤٥")).toBe(RIB);
  });
  it("validates RIB length", () => {
    expect(isValidRib(RIB)).toBe(true);
    expect(isValidRib("123")).toBe(false);
    expect(isValidRib(RIB + "1")).toBe(false);
    expect(isValidRib("00778000012345678901234a")).toBe(false);
  });
  it("masks RIB and name", () => {
    expect(maskRib(RIB)).toBe("007" + "*".repeat(17) + "2345");
    expect(maskName("Ahmed Ben Ali")).toBe("A*** B*** A***");
  });
  it("returns null for non-payout methods", () => {
    expect(validatePayoutDetails("WALLET", {})).toBeNull();
    expect(validatePayoutDetails("COUPON", {})).toBeNull();
  });
  it("BANK requires holder, bank and RIB", () => {
    expect(() => validatePayoutDetails("BANK", {})).toThrow();
    expect(() => validatePayoutDetails("BANK", { holderName: "Ali Ahmed", bankName: "CIH", rib: "1" })).toThrow();
    const d = validatePayoutDetails("BANK", { holderName: " Ali Ahmed ", bankName: "CIH", rib: "007 780 0001234567890123 45" });
    expect(d).toEqual({ method: "BANK", holderName: "Ali Ahmed", bankName: "CIH", rib: RIB });
  });
  it("agencies require only full name; ignore bank fields", () => {
    expect(() => validatePayoutDetails("CASH_PLUS", {})).toThrow();
    const d = validatePayoutDetails("WAFACASH", { fullName: "Ali Ahmed", rib: "zzz", bankName: "x" });
    expect(d).toEqual({ method: "WAFACASH", holderName: "Ali Ahmed", cinImageUrl: undefined });
  });
  it("rejects non-UploadThing CIN url", () => {
    expect(() => validatePayoutDetails("CASH_PLUS", { fullName: "Ali Ahmed", cinImageUrl: "https://evil.example/x.jpg" })).toThrow();
  });
});