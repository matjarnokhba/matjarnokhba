import { describe, it, expect } from "vitest";
import { canTransferTransition, evaluateReceipt } from "./logistics-transfer-rules";
import { transferCreateSchema, transferActionSchema } from "./logistics-transfer-validation";

describe("transfer transitions", () => {
  it("happy path", () => {
    expect(canTransferTransition("DRAFT", "PREPARED")).toBe(true);
    expect(canTransferTransition("PREPARED", "DISPATCHED")).toBe(true);
    expect(canTransferTransition("DISPATCHED", "RECEIVED")).toBe(true);
    expect(canTransferTransition("RECEIVED", "CLOSED")).toBe(true);
  });
  it("no cancel after dispatch, no skipping", () => {
    expect(canTransferTransition("DISPATCHED", "CANCELLED")).toBe(false);
    expect(canTransferTransition("DRAFT", "DISPATCHED")).toBe(false);
    expect(canTransferTransition("CLOSED", "DRAFT")).toBe(false);
    expect(canTransferTransition("CANCELLED", "PREPARED")).toBe(false);
  });
});

describe("evaluateReceipt", () => {
  it("full receipt has no discrepancy", () => {
    const r = evaluateReceipt(3, "RECEIVED");
    expect(r.ok && r.receivedQuantity === 3 && r.discrepancy === null).toBe(true);
  });
  it("missing / damaged create discrepancies", () => {
    const m = evaluateReceipt(2, "MISSING");
    expect(m.ok && m.receivedQuantity === 0 && m.discrepancy?.type === "MISSING").toBe(true);
    const d = evaluateReceipt(2, "DAMAGED");
    expect(d.ok && d.discrepancy?.type === "DAMAGED").toBe(true);
  });
  it("partial needs 1..expected-1", () => {
    expect(evaluateReceipt(5, "PARTIAL", 3).ok).toBe(true);
    expect(evaluateReceipt(5, "PARTIAL", 5).ok).toBe(false);
    expect(evaluateReceipt(5, "PARTIAL", 0).ok).toBe(false);
    expect(evaluateReceipt(1, "PARTIAL", 1).ok).toBe(false);
    expect(evaluateReceipt(5, "PARTIAL").ok).toBe(false);
  });
});

describe("transfer validation", () => {
  it("create requires distinct warehouses, reason and items", () => {
    const base = { fromWarehouseId: 1, toWarehouseId: 2, reason: "إعادة توزيع", fulfillmentItemIds: [1] };
    expect(transferCreateSchema.safeParse(base).success).toBe(true);
    expect(transferCreateSchema.safeParse({ ...base, toWarehouseId: 1 }).success).toBe(false);
    expect(transferCreateSchema.safeParse({ ...base, fulfillmentItemIds: [] }).success).toBe(false);
    expect(transferCreateSchema.safeParse({ ...base, reason: "x" }).success).toBe(false);
  });
  it("actions are discriminated and validated", () => {
    expect(transferActionSchema.safeParse({ action: "prepare" }).success).toBe(true);
    expect(transferActionSchema.safeParse({ action: "dispatch" }).success).toBe(false);
    expect(transferActionSchema.safeParse({ action: "dispatch", driverUserId: 4 }).success).toBe(true);
    expect(transferActionSchema.safeParse({ action: "cancel", reason: "" }).success).toBe(false);
    expect(transferActionSchema.safeParse({ action: "nope" }).success).toBe(false);
  });
  it("receive requires a reason for any difference", () => {
    const ok = transferActionSchema.safeParse({ action: "receive", items: [{ fulfillmentItemId: 1, outcome: "RECEIVED" }] });
    expect(ok.success).toBe(true);
    const bad = transferActionSchema.safeParse({ action: "receive", items: [{ fulfillmentItemId: 1, outcome: "MISSING" }] });
    expect(bad.success).toBe(false);
    const good = transferActionSchema.safeParse({ action: "receive", items: [{ fulfillmentItemId: 1, outcome: "MISSING", note: "لم يصل" }] });
    expect(good.success).toBe(true);
  });
});