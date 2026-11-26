import { describe, it, expect } from "vitest";
import { nextPayoutStatus } from "./refund-payout-status";

describe("payout status flow", () => {
  it("allows PROCESSING -> SENT -> COMPLETED only", () => {
    expect(nextPayoutStatus("PROCESSING", "mark_sent")).toBe("SENT");
    expect(nextPayoutStatus("SENT", "complete")).toBe("COMPLETED");
  });
  it("rejects skipping or repeating steps", () => {
    expect(nextPayoutStatus("PROCESSING", "complete")).toBeNull();
    expect(nextPayoutStatus("SENT", "mark_sent")).toBeNull();
    expect(nextPayoutStatus("COMPLETED", "mark_sent")).toBeNull();
    expect(nextPayoutStatus("COMPLETED", "complete")).toBeNull();
  });
});