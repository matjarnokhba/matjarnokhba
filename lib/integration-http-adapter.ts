/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AdapterContext, AdapterResult, CourierAdapter, CreateShipmentData, ExternalShipmentPayload, TrackingData } from "@/lib/courier-adapter";
import { httpConfigSchema, getPath, renderPath, renderTemplate, type HttpConfig } from "@/lib/integration-config";
import { checkHost, isSafeUrlSyntax } from "@/lib/integration-ssrf";
import { parseEventTime } from "@/lib/integration-webhook";

type Deps = {
  fetch: (url: string, init: any) => Promise<Response>;
  checkHost: (host: string) => Promise<"ok" | "private" | "dns">;
};

type Spec = { method: string; path: string; body?: unknown; extraHeaders?: Record<string, string>; okStatus?: number[]; vars: Record<string, unknown> };

const fail = (error: string, retryable: boolean, httpStatus?: number): { ok: false; error: string; retryable: boolean; httpStatus?: number } => ({ ok: false, error, retryable, httpStatus });

function parseCfg(ctx: AdapterContext): { cfg: HttpConfig } | { error: string } {
  const p = httpConfigSchema.safeParse(ctx.provider.config);
  if (!p.success) return { error: "إعدادات الـAPI غير مضبوطة أو غير صالحة" };
  return { cfg: p.data };
}

function applyAuth(ctx: AdapterContext, cfg: HttpConfig, headers: Record<string, string>, url: URL): string | null {
  const c = ctx.credentials;
  switch (ctx.provider.authScheme) {
    case "BEARER": {
      const t = c.token ?? c.apiKey;
      if (!t) return "بيانات الاعتماد ناقصة (token)";
      headers["Authorization"] = "Bearer " + t;
      return null;
    }
    case "API_KEY_HEADER": {
      if (!c.apiKey) return "بيانات الاعتماد ناقصة (apiKey)";
      headers[cfg.authHeaderName ?? "X-API-Key"] = c.apiKey;
      return null;
    }
    case "BASIC": {
      if (!c.username || !c.password) return "بيانات الاعتماد ناقصة (username/password)";
      headers["Authorization"] = "Basic " + Buffer.from(c.username + ":" + c.password).toString("base64");
      return null;
    }
    case "QUERY_KEY": {
      if (!c.apiKey) return "بيانات الاعتماد ناقصة (apiKey)";
      url.searchParams.set(cfg.authQueryName ?? "api_key", c.apiKey);
      return null;
    }
    default:
      return null;
  }
}

async function call(deps: Deps, ctx: AdapterContext, cfg: HttpConfig, spec: Spec): Promise<AdapterResult<{ json: any; status: number }>> {
  const base = ctx.provider.baseUrl;
  if (!base || !isSafeUrlSyntax(base)) return fail("عنوان الـAPI غير صالح أو غير مسموح", false);
  let url: URL;
  try {
    url = new URL(base.replace(/\/+$/, "") + renderPath(spec.path, spec.vars));
  } catch {
    return fail("مسار الطلب غير صالح", false);
  }
  if (url.origin !== new URL(base).origin) return fail("المسار يخرج عن نطاق الشركة", false);
  const hc = await deps.checkHost(url.hostname);
  if (hc === "private") return fail("العنوان يشير إلى شبكة داخلية", false);
  if (hc === "dns") return fail("تعذّر حلّ اسم النطاق", true);

  const vars = { ...spec.vars, cred: ctx.credentials };
  const headers: Record<string, string> = { Accept: "application/json" };
  for (const [k, v] of Object.entries(cfg.headers ?? {})) headers[k] = String(renderTemplate(v, vars) ?? "");
  for (const [k, v] of Object.entries(spec.extraHeaders ?? {})) headers[k] = v;
  const authErr = applyAuth(ctx, cfg, headers, url);
  if (authErr) return fail(authErr, false);
  if (Object.values(headers).some((v) => /[\r\n]/.test(v))) return fail("قيمة ترويسة غير صالحة", false);

  let body: string | undefined;
  if (spec.body !== undefined && spec.method !== "GET") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(spec.body);
  }
  try {
    const res = await deps.fetch(url.toString(), { method: spec.method, headers, body, redirect: "manual", signal: AbortSignal.timeout(cfg.timeoutMs) });
    const text = (await res.text()).slice(0, 262144);
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    const okStatus = spec.okStatus ?? null;
    const isOk = okStatus ? okStatus.includes(res.status) : res.status >= 200 && res.status < 300;
    if (isOk) return { ok: true, data: { json, status: res.status }, httpStatus: res.status };
    if (res.status >= 300 && res.status < 400) return fail("إعادة توجيه غير مسموحة (HTTP " + res.status + ")", false, res.status);
    const retryable = [408, 425, 429].includes(res.status) || res.status >= 500;
    const hint = json && typeof json.message === "string" ? ": " + json.message.slice(0, 120) : "";
    return fail("HTTP " + res.status + hint, retryable, res.status);
  } catch (e: any) {
    const name = e?.name;
    return fail(name === "TimeoutError" || name === "AbortError" ? "انتهت مهلة الاتصال" : "فشل الاتصال بالشركة", true);
  }
}

export function createHttpAdapter(deps?: Partial<Deps>): CourierAdapter {
  const d: Deps = { fetch: deps?.fetch ?? ((u, i) => fetch(u, i)), checkHost: deps?.checkHost ?? checkHost };
  return {
    type: "API",

    async testConnection(ctx) {
      const c = parseCfg(ctx);
      if ("error" in c) return fail(c.error, false);
      if (!c.cfg.test) return fail("لم يُضبط اختبار الاتصال (test) في الإعدادات", false);
      const r = await call(d, ctx, c.cfg, { method: c.cfg.test.method, path: c.cfg.test.path, okStatus: c.cfg.test.successStatus, vars: {} });
      if (!r.ok) return r;
      return { ok: true, data: { status: r.data.status }, httpStatus: r.httpStatus };
    },

    async createShipment(ctx, payload: ExternalShipmentPayload): Promise<AdapterResult<CreateShipmentData>> {
      const c = parseCfg(ctx);
      if ("error" in c) return fail(c.error, false);
      const cr = c.cfg.create;
      if (!cr) return fail("لم يُضبط قسم إنشاء الشحنة (create) في الإعدادات", false);
      const isTest = payload.isTest === true;
      if (isTest && !cr.testPath && !cr.testBodyExtra) {
        return fail("لمنع إنشاء شحنة حقيقية: حدّد testPath أو testBodyExtra (وضع تجريبي لدى الشركة) قبل اختبار الشحنة", false);
      }
      const vars: Record<string, unknown> = { ...payload, idempotencyKey: ctx.idempotencyKey ?? "", cred: ctx.credentials };
      let body = renderTemplate(cr.bodyTemplate, vars) as Record<string, unknown>;
      if (isTest && cr.testBodyExtra) body = { ...body, ...(renderTemplate(cr.testBodyExtra, vars) as Record<string, unknown>) };
      const extra: Record<string, string> = {};
      if (cr.idempotencyHeader && ctx.idempotencyKey) extra[cr.idempotencyHeader] = ctx.idempotencyKey;
      const r = await call(d, ctx, c.cfg, { method: cr.method, path: isTest && cr.testPath ? cr.testPath : cr.path, body, extraHeaders: extra, okStatus: cr.successStatus, vars: { ...payload } });
      if (!r.ok) return r;
      const ex = cr.externalIdPath ? getPath(r.data.json, cr.externalIdPath) : undefined;
      const tr = cr.trackingPath ? getPath(r.data.json, cr.trackingPath) : undefined;
      const externalId = ex === undefined || ex === null || ex === "" ? null : String(ex);
      const trackingNumber = tr === undefined || tr === null || tr === "" ? null : String(tr);
      if (!isTest && !externalId && !trackingNumber) return fail("الاستجابة لا تحتوي معرّفاً ولا رقم تتبع", false, r.httpStatus);
      return { ok: true, data: { externalId, trackingNumber, raw: r.data.json }, httpStatus: r.httpStatus };
    },

    async getStatus(ctx, ref): Promise<AdapterResult<TrackingData>> {
      const c = parseCfg(ctx);
      if ("error" in c) return fail(c.error, false);
      const t = c.cfg.tracking;
      if (!t) return fail("لم يُضبط قسم التتبع (tracking) في الإعدادات", false);
      const r = await call(d, ctx, c.cfg, { method: t.method, path: t.path, vars: { externalId: ref.externalId ?? "", trackingNumber: ref.trackingNumber ?? "" } });
      if (!r.ok) return r;
      const raw = getPath(r.data.json, t.statusPath);
      if (raw === undefined || raw === null || String(raw).trim() === "") return fail("الاستجابة لا تحتوي حالة", false, r.httpStatus);
      return { ok: true, data: { rawStatus: String(raw).slice(0, 100), occurredAt: t.timePath ? parseEventTime(getPath(r.data.json, t.timePath)) : null, raw: r.data.json }, httpStatus: r.httpStatus };
    },
  };
}