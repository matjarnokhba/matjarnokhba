/* eslint-disable */
import { describe, it, expect, vi } from "vitest";
import { createHmac } from "crypto";
import { createHttpAdapter } from "./integration-http-adapter";
import { httpConfigSchema, getPath, renderTemplate, renderPath } from "./integration-config";
import { isPrivateIp, isSafeUrlSyntax } from "./integration-ssrf";
import { verifySignature, extractEvents, parseEventTime } from "./integration-webhook";
import { buildTestPayload } from "./courier-adapter";

const CFG: any = {
  version: 1,
  timeoutMs: 8000,
  test: { method: "GET", path: "/ping" },
  create: {
    method: "POST",
    path: "/shipments",
    bodyTemplate: { reference: "{{reference}}", cod: "{{cod}}", name: "{{recipient.name}}", account: "{{cred.accountId}}" },
    idempotencyHeader: "Idempotency-Key",
    externalIdPath: "data.id",
    trackingPath: "data.tracking",
    testBodyExtra: { sandbox: true },
  },
  tracking: { method: "GET", path: "/shipments/{{externalId}}", statusPath: "data.status", timePath: "data.at" },
};
const mkCtx = (o: any = {}): any => ({
  provider: { id: 1, code: "X", integrationType: "API", baseUrl: "https://courier.example.com", authScheme: "BEARER", capabilities: [], config: CFG, ...(o.provider ?? {}) },
  credentials: { token: "tok", accountId: "ACC-1", ...(o.credentials ?? {}) },
  idempotencyKey: "nk-1-1-1",
});
const payload: any = { ...buildTestPayload(), isTest: false, reference: "SH-1", cod: 150 };
const mkFetch = (status: number, body: any, cap: any[] = []) =>
  vi.fn(async (url: string, init: any) => {
    cap.push({ url, init });
    return new Response(body === null ? null : JSON.stringify(body), { status });
  });
const adapter = (f: any, host: any = async () => "ok") => createHttpAdapter({ fetch: f, checkHost: host });

describe("http adapter", () => {
  it("creates a shipment with auth, idempotency and rendered body", async () => {
    const cap: any[] = [];
    const r = await adapter(mkFetch(201, { data: { id: 77, tracking: "TRK9" } }, cap)).createShipment(mkCtx(), payload);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.data.externalId).toBe("77"); expect(r.data.trackingNumber).toBe("TRK9"); }
    const { url, init } = cap[0];
    expect(url).toBe("https://courier.example.com/shipments");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.headers["Idempotency-Key"]).toBe("nk-1-1-1");
    expect(init.redirect).toBe("manual");
    const body = JSON.parse(init.body);
    expect(body).toEqual({ reference: "SH-1", cod: 150, name: payload.recipient.name, account: "ACC-1" });
  });
  it("classifies errors", async () => {
    const a = (s: number, b: any = { message: "bad" }) => adapter(mkFetch(s, b)).createShipment(mkCtx(), payload);
    const r503: any = await a(503); expect(r503.ok).toBe(false); expect(r503.retryable).toBe(true);
    const r429: any = await a(429); expect(r429.retryable).toBe(true);
    const r422: any = await a(422); expect(r422.retryable).toBe(false); expect(r422.error).toContain("HTTP 422");
    const r302: any = await a(302, null); expect(r302.retryable).toBe(false);
    const rt: any = await adapter(async () => { const e: any = new Error("t"); e.name = "TimeoutError"; throw e; }).createShipment(mkCtx(), payload);
    expect(rt.retryable).toBe(true);
    const rn: any = await adapter(async () => { throw new Error("net"); }).createShipment(mkCtx(), payload);
    expect(rn.retryable).toBe(true);
  });
  it("fails when the response has no id", async () => {
    const r: any = await adapter(mkFetch(200, { data: {} })).createShipment(mkCtx(), payload);
    expect(r.ok).toBe(false); expect(r.retryable).toBe(false);
  });
  it("blocks internal hosts and dns failures", async () => {
    const f = mkFetch(200, {});
    const r: any = await adapter(f, async () => "private").testConnection(mkCtx());
    expect(r.ok).toBe(false); expect(r.retryable).toBe(false); expect(f).not.toHaveBeenCalled();
    const d: any = await adapter(f, async () => "dns").testConnection(mkCtx());
    expect(d.retryable).toBe(true);
    const bad: any = await adapter(f).testConnection(mkCtx({ provider: { baseUrl: "https://127.0.0.1" } }));
    expect(bad.ok).toBe(false); expect(f).not.toHaveBeenCalled();
  });
  it("needs credentials and config", async () => {
    const f = mkFetch(200, {});
    expect(((await adapter(f).testConnection(mkCtx({ credentials: { token: "" } }))) as any).ok).toBe(false);
    expect(((await adapter(f).testConnection(mkCtx({ provider: { config: null } }))) as any).ok).toBe(false);
    expect(((await adapter(f).testConnection(mkCtx({ provider: { config: { ...CFG, test: undefined } } }))) as any).error).toContain("test");
    expect(f).not.toHaveBeenCalled();
  });
  it("never creates a real shipment on test without a sandbox setting", async () => {
    const f = mkFetch(200, { data: { id: 1 } });
    const noSandbox = { ...CFG, create: { ...CFG.create, testBodyExtra: undefined } };
    const r: any = await adapter(f).createShipment(mkCtx({ provider: { config: noSandbox } }), { ...payload, isTest: true });
    expect(r.ok).toBe(false); expect(f).not.toHaveBeenCalled();
    const cap: any[] = [];
    const ok: any = await adapter(mkFetch(200, { data: {} }, cap)).createShipment(mkCtx(), { ...payload, isTest: true });
    expect(ok.ok).toBe(true);
    expect(JSON.parse(cap[0].init.body).sandbox).toBe(true);
  });
  it("supports other auth schemes", async () => {
    const cap: any[] = [];
    await adapter(mkFetch(200, {}, cap)).testConnection(mkCtx({ provider: { authScheme: "QUERY_KEY" }, credentials: { apiKey: "k1" } }));
    expect(cap[0].url).toContain("api_key=k1");
    await adapter(mkFetch(200, {}, cap)).testConnection(mkCtx({ provider: { authScheme: "API_KEY_HEADER" }, credentials: { apiKey: "k2" } }));
    expect(cap[1].init.headers["X-API-Key"]).toBe("k2");
    await adapter(mkFetch(200, {}, cap)).testConnection(mkCtx({ provider: { authScheme: "BASIC" }, credentials: { username: "u", password: "p" } }));
    expect(cap[2].init.headers.Authorization).toBe("Basic " + Buffer.from("u:p").toString("base64"));
  });
  it("rejects header injection from credentials", async () => {
    const f = mkFetch(200, {});
    const r: any = await adapter(f).testConnection(mkCtx({ credentials: { token: "a\r\nX-Evil: 1" } }));
    expect(r.ok).toBe(false); expect(f).not.toHaveBeenCalled();
  });
  it("reads tracking status", async () => {
    const cap: any[] = [];
    const a: any = adapter(mkFetch(200, { data: { status: "En transit", at: "2026-11-27T10:00:00Z" } }, cap));
    const r = await a.getStatus(mkCtx(), { externalId: "A/B 1", trackingNumber: null });
    expect(r.ok).toBe(true);
    expect(r.data.rawStatus).toBe("En transit");
    expect(r.data.occurredAt.toISOString()).toBe("2026-11-27T10:00:00.000Z");
    expect(cap[0].url).toBe("https://courier.example.com/shipments/A%2FB%201");
  });
});

describe("config + templates", () => {
  it("validates config strictly", () => {
    expect(httpConfigSchema.safeParse(CFG).success).toBe(true);
    expect(httpConfigSchema.safeParse({ ...CFG, extra: 1 }).success).toBe(false);
    expect(httpConfigSchema.safeParse({ version: 1, headers: { Authorization: "Bearer abc" } }).success).toBe(false);
    expect(httpConfigSchema.safeParse({ version: 1, headers: { Authorization: "{{cred.token}}" } }).success).toBe(true);
    expect(httpConfigSchema.safeParse({ version: 1, headers: { "X-Client": "nokhba" } }).success).toBe(true);
    expect(httpConfigSchema.safeParse({ version: 1, test: { method: "GET", path: "/a/../b" } }).success).toBe(false);
    expect(httpConfigSchema.safeParse({ version: 1, test: { method: "GET", path: "//evil.com" } }).success).toBe(false);
    expect(httpConfigSchema.safeParse({ version: 1, test: { method: "DELETE", path: "/a" } }).success).toBe(false);
  });
  it("renders templates keeping types and blocking prototype paths", () => {
    expect(renderTemplate({ n: "{{a}}", s: "x-{{b}}", arr: ["{{a}}"] }, { a: 5, b: "y" })).toEqual({ n: 5, s: "x-y", arr: [5] });
    expect(getPath({ a: { b: [10, 20] } }, "a.b.1")).toBe(20);
    expect(getPath({}, "__proto__.x")).toBeUndefined();
    expect(renderPath("/s/{{id}}", { id: "a/b?c" })).toBe("/s/a%2Fb%3Fc");
  });
});

describe("ssrf", () => {
  it("flags private addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.0.1", "172.31.255.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "224.0.0.1"]) expect(isPrivateIp(ip)).toBe(true);
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700::1111"]) expect(isPrivateIp(ip)).toBe(false);
  });
  it("accepts only public https domains", () => {
    expect(isSafeUrlSyntax("https://courier.example.com")).toBe(true);
    expect(isSafeUrlSyntax("https://api.example.com/v1")).toBe(true);
    for (const u of ["http://x.com", "https://127.0.0.1", "https://[::1]", "https://localhost", "https://db.internal", "https://a.com:8443", "https://u:p@x.com", "https://2130706433", "https://intranet", "not a url"]) expect(isSafeUrlSyntax(u)).toBe(false);
  });
});

describe("webhook signature + events", () => {
  const secret = "s3cret";
  const body = JSON.stringify({ a: 1 });
  const hex = createHmac("sha256", secret).update(body).digest("hex");
  const b64 = createHmac("sha256", secret).update(body).digest("base64");
  it("verifies hex, base64 and prefixed signatures", () => {
    expect(verifySignature({ secret, rawBody: body, signature: hex }).ok).toBe(true);
    expect(verifySignature({ secret, rawBody: body, signature: "sha256=" + hex }).ok).toBe(true);
    expect(verifySignature({ secret, rawBody: body, signature: b64 }).ok).toBe(true);
  });
  it("rejects bad, missing and tampered", () => {
    expect(verifySignature({ secret, rawBody: body, signature: null }).ok).toBe(false);
    expect(verifySignature({ secret: "other", rawBody: body, signature: hex }).ok).toBe(false);
    expect(verifySignature({ secret, rawBody: body + " ", signature: hex }).ok).toBe(false);
    expect(verifySignature({ secret, rawBody: body, signature: "zz" }).ok).toBe(false);
  });
  it("enforces timestamp freshness when required", () => {
    const now = 1_800_000_000_000;
    const ts = String(Math.floor(now / 1000));
    const sig = createHmac("sha256", secret).update(ts + "." + body).digest("hex");
    expect(verifySignature({ secret, rawBody: body, signature: sig, timestamp: ts, requireTimestamp: true, now }).ok).toBe(true);
    expect(verifySignature({ secret, rawBody: body, signature: sig, timestamp: ts, requireTimestamp: true, now: now + 3600000 })).toEqual({ ok: false, reason: "STALE_TIMESTAMP" });
    expect(verifySignature({ secret, rawBody: body, signature: sig, timestamp: null, requireTimestamp: true, now })).toEqual({ ok: false, reason: "MISSING_TIMESTAMP" });
    expect(verifySignature({ secret, rawBody: body, signature: hex, timestamp: ts, requireTimestamp: true, now }).ok).toBe(false);
  });
  it("extracts events: single, array, nested, custom paths", () => {
    const now = Date.parse("2026-11-27T12:00:00Z");
    const one = extractEvents(undefined, { eventId: "e1", externalId: "X1", status: "livré", occurredAt: "2026-11-27T11:00:00Z" }, now);
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ eventId: "e1", externalId: "X1", rawStatus: "livré" });
    expect(extractEvents(undefined, [{ status: "a" }, { status: "" }, { nostatus: 1 }, { status: "b" }], now)).toHaveLength(2);
    const nested = extractEvents({ eventsPath: "data.events", externalIdPath: "ref", statusPath: "state", timePath: "ts" }, { data: { events: [{ ref: 5, state: "ok", ts: 1795000000 }] } }, now);
    expect(nested[0].externalId).toBe("5");
    expect(extractEvents(undefined, "garbage", now)).toEqual([]);
    expect(extractEvents(undefined, Array.from({ length: 80 }, () => ({ status: "x" })), now)).toHaveLength(50);
  });
  it("sanitizes event times", () => {
    const now = Date.parse("2026-11-27T12:00:00Z");
    expect(parseEventTime("2026-11-27T11:00:00Z", now).toISOString()).toBe("2026-11-27T11:00:00.000Z");
    expect(parseEventTime("2030-01-01T00:00:00Z", now).getTime()).toBe(now);
    expect(parseEventTime("junk", now).getTime()).toBe(now);
    expect(parseEventTime(1795000000, now).getTime()).toBe(1795000000000);
    expect(parseEventTime(0, now).getTime()).toBe(now);
  });
});