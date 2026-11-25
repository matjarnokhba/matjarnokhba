import { describe, it, expect } from "vitest";
import { buildWalletSummary, displayAmount } from "./wallet-summary";

describe("displayAmount", () => {
  it("shows refund deductions as negative", () => {
    expect(displayAmount("REFUND_DEDUCTION", 45)).toBe(-45);
    expect(displayAmount("REFUND_DEDUCTION", "45.50")).toBe(-45.5);
    expect(displayAmount("REFUND_DEDUCTION", -45)).toBe(-45);
  });
  it("keeps other types as stored", () => {
    expect(displayAmount("HELD_EARNING", 90)).toBe(90);
    expect(displayAmount("WITHDRAWAL", -300)).toBe(-300);
    expect(displayAmount("MANUAL_ADJUSTMENT", -20)).toBe(-20);
  });
  it("is safe on bad input", () => {
    expect(displayAmount("HELD_EARNING", "abc")).toBe(0);
  });
});

describe("buildWalletSummary", () => {
  it("computes net and net after costs", () => {
    const s = buildWalletSummary({
      totalRevenue: 1000,
      totalCommission: 100,
      refundDeductionSum: 90,
      returnShippingSum: -20,
      subscriptionSum: -50,
      withdrawalSum: -300,
      rejectedWithdrawalSum: 100,
    });
    expect(s.netEarnings).toBe(900);
    expect(s.returnShipping).toBe(20);
    expect(s.subscriptions).toBe(50);
    expect(s.netAfterCosts).toBe(830);
    expect(s.withdrawn).toBe(200);
    expect(s.refundsDeducted).toBe(90);
  });
  it("handles empty values", () => {
    const s = buildWalletSummary({
      totalRevenue: 0, totalCommission: 0, refundDeductionSum: 0,
      returnShippingSum: 0, subscriptionSum: 0, withdrawalSum: 0, rejectedWithdrawalSum: 0,
    });
    expect(s.netAfterCosts).toBe(0);
    expect(s.withdrawn).toBe(0);
  });
  it("never reports negative withdrawn", () => {
    const s = buildWalletSummary({
      totalRevenue: 0, totalCommission: 0, refundDeductionSum: 0,
      returnShippingSum: 0, subscriptionSum: 0, withdrawalSum: -50, rejectedWithdrawalSum: 80,
    });
    expect(s.withdrawn).toBe(0);
  });
});