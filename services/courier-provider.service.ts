/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { LogisticsError } from "@/lib/logistics-errors";
import { logLogisticsAudit } from "@/lib/logistics-audit";
import { sealJson, openJson, generateWebhookSecret, generateWebhookToken } from "@/lib/integration-crypto";
import { logIntegration } from "@/lib/integration-log";
import { getAdapter, buildTestPayload, type AdapterResult } from "@/lib/courier-adapter";
import { CANONICAL_STATUSES, DEFAULT_STATUS_MAP, isFinalStatus, normalizeExternalStatus } from "@/lib/integration-status";
import type { ProviderAction, ProviderCreateInput } from "@/lib/integration-validation";
import type { Actor } from "@/services/logistics-admin.service";

type Opts = { tx?: any };

async function run<T>(opts: Opts | undefined, fn: (tx: any) => Promise<T>): Promise<T> {
  if (opts?.tx) return fn(opts.tx);
  return (prisma as any).$transaction(fn, { timeout: 20000 }) as Promise<T>;
}

function needPlatform(actor: Actor) {
  if (!actor.scope.platform) throw new LogisticsError("هذه العملية للأدمن فقط", 403);
}

/** لا يتضمن أي بيانات اعتماد أو أسرار. */
const SELECT = {
  id: true,
  code: true,
  name: true,
  integrationType: true,
  status: true,
  authScheme: true,
  baseUrl: true,
  config: true,
  capabilities: true,
  credentialsKeys: true,
  webhookToken: true,
  connectionTestedAt: true,
  connectionTestOk: true,
  shipmentTestedAt: true,
  shipmentTestOk: true,
  activatedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

function pub(p: any) {
  if (!p) return p;
  return { ...p, hasCredentials: Array.isArray(p.credentialsKeys) && p.credentialsKeys.length > 0 };
}

async function fetchPublic(db: any, id: number) {
  const p = await db.shippingProvider.findUnique({ where: { id }, select: { ...SELECT, _count: { select: { companies: true, statusMappings: true } } } });
  if (!p) throw new LogisticsError("الشركة غير موجودة", 404);
  return pub(p);
}

const RESET_TESTS = { connectionTestOk: false, connectionTestedAt: null, shipmentTestOk: false, shipmentTestedAt: null } as const;

async function runTest(actor: Actor, id: number, action: "test_connection" | "test_shipment", opts?: Opts) {
  const db = opts?.tx ?? prisma;
  const p = await db.shippingProvider.findUnique({ where: { id }, select: { ...SELECT, credentialsEnc: true } });
  if (!p) throw new LogisticsError("الشركة غير موجودة", 404);
  let credentials: Record<string, string> = {};
  if (p.credentialsEnc) credentials = openJson<Record<string, string>>("credentials", "provider:" + id, p.credentialsEnc);
  const adapter = getAdapter(p.integrationType);
  const ctx = {
    provider: { id: p.id, code: p.code, integrationType: p.integrationType, baseUrl: p.baseUrl, authScheme: p.authScheme, capabilities: p.capabilities, config: p.config },
    credentials,
  };
  const payload = buildTestPayload();
  const t0 = Date.now();
  let res: AdapterResult<unknown>;
  try {
    res = action === "test_connection" ? await adapter.testConnection(ctx) : await adapter.createShipment(ctx, payload);
  } catch (e) {
    res = { ok: false, error: e instanceof Error ? e.message : "خطأ غير متوقع", retryable: false };
  }
  const ms = Date.now() - t0;
  await run(opts, async (tx) => {
    const now = new Date();
    await tx.shippingProvider.update({
      where: { id },
      data: action === "test_connection" ? { connectionTestedAt: now, connectionTestOk: res.ok } : { shipmentTestedAt: now, shipmentTestOk: res.ok },
    });
    await logIntegration(tx, {
      providerId: id,
      direction: "OUTBOUND",
      operation: action === "test_connection" ? "TEST_CONNECTION" : "TEST_SHIPMENT",
      ok: res.ok,
      httpStatus: res.httpStatus ?? null,
      durationMs: ms,
      request: action === "test_shipment" ? payload : null,
      response: res.ok ? res.data : null,
      error: res.ok ? null : res.error,
    });
    await logLogisticsAudit(tx, {
      userId: actor.id,
      action: action === "test_connection" ? "LOGISTICS_PROVIDER_TEST_CONNECTION" : "LOGISTICS_PROVIDER_TEST_SHIPMENT",
      entityType: "ShippingProvider",
      entityId: id,
      after: { ok: res.ok, error: res.ok ? null : res.error },
    });
  });
  return { provider: await fetchPublic(db, id), result: { ok: res.ok, error: res.ok ? null : res.error } };
}

export const CourierProviderService = {
  async list(actor: Actor, opts?: Opts) {
    needPlatform(actor);
    const rows = await ((opts?.tx ?? prisma) as any).shippingProvider.findMany({
      orderBy: { id: "asc" },
      take: 200,
      select: { ...SELECT, _count: { select: { companies: true, statusMappings: true } } },
    });
    return rows.map(pub);
  },

  async get(actor: Actor, id: number, opts?: Opts) {
    needPlatform(actor);
    const db = opts?.tx ?? prisma;
    const provider = await fetchPublic(db, id);
    const mappings = await db.providerStatusMapping.findMany({ where: { providerId: id }, orderBy: { externalStatus: "asc" } });
    return { provider, mappings };
  },

  async create(actor: Actor, input: ProviderCreateInput, opts?: Opts) {
    needPlatform(actor);
    const code = input.code.toUpperCase();
    const webhookSecret = generateWebhookSecret();
    const provider = await run(opts, async (tx) => {
      const dup = await tx.shippingProvider.findUnique({ where: { code }, select: { id: true } });
      if (dup) throw new LogisticsError("الكود مستخدم مسبقاً", 409);
      const created = await tx.shippingProvider.create({
        data: {
          code,
          name: input.name,
          integrationType: input.integrationType,
          authScheme: input.authScheme ?? "NONE",
          baseUrl: input.baseUrl ?? null,
          capabilities: input.capabilities ?? (input.integrationType === "MANUAL" ? ["MANUAL_TRACKING"] : []),
          webhookToken: generateWebhookToken(),
          notes: input.notes ?? null,
          createdById: input.integrationType ? actor.id : actor.id,
          isActive: false,
        },
        select: { id: true },
      });
      await tx.shippingProvider.update({ where: { id: created.id }, data: { webhookSecretEnc: sealJson("webhook", "provider:" + created.id, { secret: webhookSecret }) } });
      const pubRow = await fetchPublic(tx, created.id);
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_PROVIDER_CREATE", entityType: "ShippingProvider", entityId: created.id, after: pubRow });
      return pubRow;
    });
    return { provider, webhookSecret };
  },

  async act(actor: Actor, id: number, a: ProviderAction, opts?: Opts): Promise<any> {
    needPlatform(actor);
    if (a.action === "test_connection" || a.action === "test_shipment") return runTest(actor, id, a.action, opts);

    return run(opts, async (tx) => {
      const p = await tx.shippingProvider.findUnique({ where: { id }, select: { ...SELECT } });
      if (!p) throw new LogisticsError("الشركة غير موجودة", 404);
      const demote = p.status === "ACTIVE" ? { status: "TESTING", isActive: false } : {};

      switch (a.action) {
        case "update": {
          const data: Record<string, unknown> = {};
          let reset = false;
          if (a.name !== undefined) data.name = a.name;
          if (a.notes !== undefined) data.notes = a.notes;
          if (a.baseUrl !== undefined && a.baseUrl !== p.baseUrl) { data.baseUrl = a.baseUrl; reset = true; }
          if (a.authScheme !== undefined && a.authScheme !== p.authScheme) { data.authScheme = a.authScheme; reset = true; }
          if (a.capabilities !== undefined) { data.capabilities = a.capabilities; reset = true; }
          if (Object.keys(data).length === 0) throw new LogisticsError("لا توجد تغييرات", 400);
          if (reset) Object.assign(data, RESET_TESTS, demote);
          await tx.shippingProvider.update({ where: { id }, data });
          const after = await fetchPublic(tx, id);
          await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_PROVIDER_UPDATE", entityType: "ShippingProvider", entityId: id, before: p, after });
          return { provider: after };
        }
        case "set_credentials": {
          const keys = Object.keys(a.fields).sort();
          await tx.shippingProvider.update({
            where: { id },
            data: { credentialsEnc: sealJson("credentials", "provider:" + id, a.fields), credentialsKeys: keys, ...RESET_TESTS, ...demote },
          });
          await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_PROVIDER_SET_CREDENTIALS", entityType: "ShippingProvider", entityId: id, after: { keys } });
          return { provider: await fetchPublic(tx, id) };
        }
        case "clear_credentials": {
          await tx.shippingProvider.update({ where: { id }, data: { credentialsEnc: null, credentialsKeys: [], ...RESET_TESTS, ...demote } });
          await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_PROVIDER_CLEAR_CREDENTIALS", entityType: "ShippingProvider", entityId: id });
          return { provider: await fetchPublic(tx, id) };
        }
        case "set_status": {
          const to = a.status;
          if (to === p.status) throw new LogisticsError("الحالة الحالية مطابقة", 409);
          if (to === "TESTING") {
            if (p.capabilities.length === 0) throw new LogisticsError("حدّد إمكانيات الشركة أولاً", 409);
          }
          if (to === "ACTIVE") {
            if (!["TESTING", "DISABLED"].includes(p.status)) throw new LogisticsError("انقل الشركة إلى مرحلة الاختبار أولاً", 409);
            if (p.capabilities.length === 0) throw new LogisticsError("حدّد إمكانيات الشركة أولاً", 409);
            if (p.integrationType === "API" && !p.config) throw new LogisticsError("اضبط إعدادات اتصال الـAPI أولاً", 409);
            if (!p.connectionTestOk || !p.shipmentTestOk) throw new LogisticsError("نفّذ اختبار الاتصال واختبار الشحنة بنجاح قبل التفعيل", 409);
          }
          await tx.shippingProvider.update({
            where: { id },
            data: { status: to, isActive: to === "ACTIVE", ...(to === "ACTIVE" ? { activatedAt: new Date(), activatedById: actor.id } : {}) },
          });
          await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_PROVIDER_STATUS", entityType: "ShippingProvider", entityId: id, before: { status: p.status }, after: { status: to } });
          return { provider: await fetchPublic(tx, id) };
        }
        case "rotate_webhook_secret": {
          const secret = generateWebhookSecret();
          await tx.shippingProvider.update({ where: { id }, data: { webhookSecretEnc: sealJson("webhook", "provider:" + id, { secret }) } });
          await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_PROVIDER_ROTATE_WEBHOOK", entityType: "ShippingProvider", entityId: id });
          return { provider: await fetchPublic(tx, id), webhookSecret: secret };
        }
        case "set_mappings": {
          const seen = new Set<string>();
          for (const m of a.mappings) {
            const key = normalizeExternalStatus(m.externalStatus);
            if (!key) throw new LogisticsError("نص حالة فارغ", 400);
            seen.add(key);
            await tx.providerStatusMapping.upsert({
              where: { providerId_externalStatus: { providerId: id, externalStatus: key } },
              create: { providerId: id, externalStatus: key, canonicalStatus: m.canonicalStatus, isFinal: isFinalStatus(m.canonicalStatus) },
              update: { canonicalStatus: m.canonicalStatus, isFinal: isFinalStatus(m.canonicalStatus) },
            });
          }
          await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_PROVIDER_SET_MAPPINGS", entityType: "ShippingProvider", entityId: id, after: { count: seen.size } });
          return { mappings: await tx.providerStatusMapping.findMany({ where: { providerId: id }, orderBy: { externalStatus: "asc" } }) };
        }
        case "set_config": {
          if (p.integrationType !== "API") throw new LogisticsError("إعدادات HTTP للربط عبر API فقط", 409);
          await tx.shippingProvider.update({ where: { id }, data: { config: a.config as any, ...RESET_TESTS, ...demote } });
          await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_PROVIDER_SET_CONFIG", entityType: "ShippingProvider", entityId: id, after: { sections: Object.keys(a.config) } });
          return { provider: await fetchPublic(tx, id) };
        }
        case "apply_default_mappings": {
          const rows = Object.entries(DEFAULT_STATUS_MAP).map(([k, v]) => ({
            providerId: id,
            externalStatus: normalizeExternalStatus(k),
            canonicalStatus: v,
            isFinal: isFinalStatus(v),
          }));
          const r = await tx.providerStatusMapping.createMany({ data: rows, skipDuplicates: true });
          await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_PROVIDER_APPLY_DEFAULT_MAPPINGS", entityType: "ShippingProvider", entityId: id, after: { added: r.count } });
          return { added: r.count, mappings: await tx.providerStatusMapping.findMany({ where: { providerId: id }, orderBy: { externalStatus: "asc" } }) };
        }
      }
    });
  },

  async setCompanyProvider(actor: Actor, companyId: number, providerId: number | null, opts?: Opts) {
    needPlatform(actor);
    return run(opts, async (tx) => {
      const c = await tx.logisticsCompany.findUnique({ where: { id: companyId }, select: { id: true, kind: true, providerId: true } });
      if (!c) throw new LogisticsError("الشركة غير موجودة", 404);
      if (c.kind !== "EXTERNAL") throw new LogisticsError("الربط بشركة توصيل خارجية للشركات الخارجية فقط", 409);
      if (providerId !== null) {
        const p = await tx.shippingProvider.findUnique({ where: { id: providerId }, select: { id: true, status: true } });
        if (!p) throw new LogisticsError("شركة التوصيل غير موجودة", 404);
      }
      if (c.providerId === providerId) throw new LogisticsError("القيمة الحالية مطابقة", 409);
      if (c.providerId !== null) {
        const open = await tx.externalShipment.count({ where: { providerId: c.providerId, active: true, companyId } });
        if (open > 0) throw new LogisticsError("يوجد " + open + " شحنة خارجية نشطة مع الشركة الحالية", 409);
      }
      await tx.logisticsCompany.update({ where: { id: companyId }, data: { providerId } });
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_PROVIDER_COMPANY_LINK", entityType: "LogisticsCompany", entityId: companyId, before: { providerId: c.providerId }, after: { providerId } });
      return { companyId, providerId };
    });
  },
};

export { CANONICAL_STATUSES };