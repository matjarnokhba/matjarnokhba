/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll } from "vitest";
import { sealJson, openJson } from "./integration-crypto";
import { redactSecrets, compactForLog } from "./integration-redact";
import { decideEvent, deriveEventId, normalizeExternalStatus, DEFAULT_STATUS_MAP, CANONICAL_STATUSES, isFinalStatus } from "./integration-status";
import { getAdapter, buildTestPayload } from "./courier-adapter";
import { providerCreateSchema, providerActionSchema } from "./integration-validation";

beforeAll(() => {
  process.env.SELLER_DATA_KEY = "ab".repeat(32);
});

describe("integration crypto", () => {
  it("round-trips and never stores plaintext", () => {
    const sealed = sealJson("credentials", "provider:1", { apiKey: "sk_live_SECRET" });
    expect(Buffer.from(sealed).includes(Buffer.from("SECRET"))).toBe(false);
    expect(openJson<{ apiKey: string }>("credentials", "provider:1", sealed).apiKey).toBe("sk_live_SECRET");
  });
  it("is bound to its record and purpose", () => {
    const sealed = sealJson("credentials", "provider:1", { a: "b" });
    expect(() => openJson("credentials", "provider:2", sealed)).toThrow();
    expect(() => openJson("webhook", "provider:1", sealed)).toThrow();
  });
  it("detects tampering", () => {
    const sealed = Buffer.from(sealJson("credentials", "provider:1", { a: "b" }));
    sealed[sealed.length - 1] ^= 1;
    expect(() => openJson("credentials", "provider:1", sealed)).toThrow();
  });
  it("uses a fresh IV each time", () => {
    const a = Buffer.from(sealJson("credentials", "p", { a: 1 })).toString("hex");
    const b = Buffer.from(sealJson("credentials", "p", { a: 1 })).toString("hex");
    expect(a).not.toBe(b);
  });
});

describe("redaction", () => {
  it("masks sensitive keys at any depth", () => {
    const r = redactSecrets({ apiKey: "x", nested: { Authorization: "Bearer y", ok: 1 }, list: [{ password: "z" }] }) as any;
    expect(r.apiKey).toBe("***");
    expect(r.nested.Authorization).toBe("***");
    expect(r.nested.ok).toBe(1);
    expect(r.list[0].password).toBe("***");
  });
  it("truncates huge payloads", () => {
    const big = Object.fromEntries(Array.from({ length: 40 }, (_, i) => ["k" + i, "x".repeat(1500)]));
    expect(compactForLog(big)).toEqual({ truncated: true });
  });
  it("keeps small payloads intact", () => {
    expect(compactForLog({ a: 1, b: "x" })).toEqual({ a: 1, b: "x" });
  });
});

describe("status engine", () => {
  it("normalizes external labels", () => {
    expect(normalizeExternalStatus("  Out_For-Delivery ")).toBe("out for delivery");
  });
  it("default map only targets canonical statuses", () => {
    for (const v of Object.values(DEFAULT_STATUS_MAP)) expect(CANONICAL_STATUSES).toContain(v);
    expect(DEFAULT_STATUS_MAP["livré"]).toBe("DELIVERED");
  });
  it("applies a normal progression", () => {
    expect(decideEvent({ status: "SUBMITTED", lastEventAt: new Date(1000) }, { canonical: "IN_TRANSIT", occurredAt: new Date(2000) })).toEqual({ apply: true });
  });
  it("ignores late, same-state and post-final events", () => {
    expect(decideEvent({ status: "IN_TRANSIT", lastEventAt: new Date(2000) }, { canonical: "PICKED_UP", occurredAt: new Date(1000) })).toEqual({ apply: false, reason: "LATE" });
    expect(decideEvent({ status: "IN_TRANSIT", lastEventAt: null }, { canonical: "IN_TRANSIT", occurredAt: new Date(1) })).toEqual({ apply: false, reason: "SAME_STATE" });
    expect(decideEvent({ status: "DELIVERED", lastEventAt: new Date(1) }, { canonical: "IN_TRANSIT", occurredAt: new Date(9) })).toEqual({ apply: false, reason: "TERMINAL" });
    expect(isFinalStatus("RETURNED")).toBe(true);
  });
  it("allows delivery retry loops", () => {
    expect(decideEvent({ status: "FAILED_ATTEMPT", lastEventAt: new Date(1) }, { canonical: "OUT_FOR_DELIVERY", occurredAt: new Date(5) })).toEqual({ apply: true });
  });
  it("derives stable event ids", () => {
    const p = { providerId: 1, externalId: "A1", rawStatus: " Livré ", occurredAt: new Date("2026-01-01T00:00:00Z") };
    expect(deriveEventId(p)).toBe(deriveEventId({ ...p, rawStatus: "livré" }));
    expect(deriveEventId(p)).not.toBe(deriveEventId({ ...p, externalId: "A2" }));
  });
});

describe("adapters", () => {
  it("manual adapter passes tests offline", async () => {
    const a = getAdapter("MANUAL");
    const ctx = { provider: { id: 1, code: "X", integrationType: "MANUAL", baseUrl: null, authScheme: "NONE", capabilities: [], config: null }, credentials: {} };
    expect((await a.testConnection(ctx)).ok).toBe(true);
    expect((await a.createShipment(ctx, buildTestPayload())).ok).toBe(true);
  });
  it("unimplemented types refuse clearly", async () => {
    const ctx = { provider: { id: 1, code: "X", integrationType: "API", baseUrl: null, authScheme: "NONE", capabilities: [], config: null }, credentials: {} };
    const r = await getAdapter("API").testConnection(ctx);
    expect(r.ok).toBe(false);
  });
});

describe("integration validation", () => {
  it("provider create", () => {
    expect(providerCreateSchema.safeParse({ code: "AMANA-1", name: "أمانة", integrationType: "MANUAL" }).success).toBe(true);
    expect(providerCreateSchema.safeParse({ code: "a", name: "x", integrationType: "MANUAL" }).success).toBe(false);
    expect(providerCreateSchema.safeParse({ code: "AMANA-1", name: "أمانة", integrationType: "API", baseUrl: "http://x.com" }).success).toBe(false);
  });
  it("actions", () => {
    expect(providerActionSchema.safeParse({ action: "set_credentials", fields: {} }).success).toBe(false);
    expect(providerActionSchema.safeParse({ action: "set_credentials", fields: { apiKey: "k" } }).success).toBe(true);
    expect(providerActionSchema.safeParse({ action: "set_status", status: "DRAFT" }).success).toBe(false);
    expect(providerActionSchema.safeParse({ action: "set_mappings", mappings: [{ externalStatus: "x", canonicalStatus: "NOPE" }] }).success).toBe(false);
    expect(providerActionSchema.safeParse({ action: "set_mappings", mappings: [{ externalStatus: "x", canonicalStatus: "DELIVERED" }] }).success).toBe(true);
  });
});