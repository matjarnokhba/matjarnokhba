import { describe, it, expect } from "vitest";
import { buildShipmentPayload, normalizePhone, TransformError } from "./integration-transform";
import { nextRetryDelayMs, newIdempotencyKey, MAX_ATTEMPTS } from "./integration-dispatch";
import { dispatchSchema, externalActionSchema } from "./external-shipment-validation";

const order = (n: string, over: Record<string, unknown> = {}) => ({
  orderNumber: n,
  address: { fullName: "أحمد", phone: "0612 345 678", city: "فاس", district: "المرينيين", street: "شارع 1", buildingNumber: "12", ...over },
  customer: { id: 1, name: "أحمد", email: "a@b.c" },
});

describe("order transformer", () => {
  it("normalizes phones", () => {
    expect(normalizePhone("+212 612-345-678")).toBe("0612345678");
    expect(normalizePhone("00212612345678")).toBe("0612345678");
    expect(normalizePhone("212612345678")).toBe("0612345678");
  });
  it("builds a unified payload and keeps original order numbers", () => {
    const p = buildShipmentPayload({ shipmentNumber: "SH-1", totalCOD: 199.999, orders: [order("O-1"), order("O-2")] });
    expect(p.reference).toBe("SH-1");
    expect(p.cod).toBe(200);
    expect(p.orderNumbers).toEqual(["O-1", "O-2"]);
    expect(p.recipient.phone).toBe("0612345678");
    expect(p.recipient.address).toBe("شارع 1 12");
  });
  it("falls back to customer name", () => {
    const p = buildShipmentPayload({ shipmentNumber: "S", totalCOD: 0, orders: [order("O", { fullName: "" })] });
    expect(p.recipient.name).toBe("أحمد");
  });
  it("rejects missing data, bad phone, mixed recipients, no orders", () => {
    expect(() => buildShipmentPayload({ shipmentNumber: "S", totalCOD: 1, orders: [] })).toThrow(TransformError);
    expect(() => buildShipmentPayload({ shipmentNumber: "S", totalCOD: 1, orders: [order("O", { city: "" })] })).toThrow(/المدينة/);
    expect(() => buildShipmentPayload({ shipmentNumber: "S", totalCOD: 1, orders: [order("O", { phone: "12" })] })).toThrow(/هاتف/);
    expect(() => buildShipmentPayload({ shipmentNumber: "S", totalCOD: 1, orders: [order("O1"), order("O2", { city: "سلا" })] })).toThrow(/مختلفة/);
    expect(() => buildShipmentPayload({ shipmentNumber: "S", totalCOD: -5, orders: [order("O")] })).toThrow();
  });
});

describe("retry schedule", () => {
  it("backs off then stops", () => {
    expect(nextRetryDelayMs(1)).toBe(60000);
    expect(nextRetryDelayMs(2)).toBe(300000);
    expect(nextRetryDelayMs(3)).toBe(900000);
    expect(nextRetryDelayMs(4)).toBe(3600000);
    expect(nextRetryDelayMs(5)).toBe(21600000);
    expect(nextRetryDelayMs(MAX_ATTEMPTS)).toBeNull();
    expect(nextRetryDelayMs(99)).toBeNull();
  });
  it("builds stable idempotency keys", () => {
    expect(newIdempotencyKey(5, 2, 1)).toBe("nk-5-2-1");
    expect(newIdempotencyKey(5, 2, 1)).not.toBe(newIdempotencyKey(5, 2, 2));
  });
});

describe("external shipment validation", () => {
  it("dispatch", () => {
    expect(dispatchSchema.safeParse({ shipmentId: 1, providerId: 2 }).success).toBe(true);
    expect(dispatchSchema.safeParse({ shipmentId: 0, providerId: 2 }).success).toBe(false);
  });
  it("actions", () => {
    expect(externalActionSchema.safeParse({ action: "retry" }).success).toBe(true);
    expect(externalActionSchema.safeParse({ action: "add_event", rawStatus: "livré", occurredAt: "2026-11-27T10:00:00.000Z" }).success).toBe(true);
    expect(externalActionSchema.safeParse({ action: "add_event", rawStatus: "x", canonicalStatus: "NOPE" }).success).toBe(false);
    expect(externalActionSchema.safeParse({ action: "add_event", rawStatus: "x", occurredAt: "yesterday" }).success).toBe(false);
  });
});