/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { LogisticsError } from "@/lib/logistics-errors";
import { logLogisticsAudit } from "@/lib/logistics-audit";
import { openJson } from "@/lib/integration-crypto";
import { logIntegration } from "@/lib/integration-log";
import { compactForLog } from "@/lib/integration-redact";
import { getAdapter, type AdapterResult, type CreateShipmentData, type ExternalShipmentPayload } from "@/lib/courier-adapter";
import { decideEvent, deriveEventId, isFinalStatus, normalizeExternalStatus } from "@/lib/integration-status";
import { buildShipmentPayload, TransformError } from "@/lib/integration-transform";
import { newIdempotencyKey, nextRetryDelayMs, SUBMITTING_STALE_MS } from "@/lib/integration-dispatch";
import type { DispatchInput, ExternalAction } from "@/lib/external-shipment-validation";
import type { Actor } from "@/services/logistics-admin.service";

type Opts = { tx?: any };

async function run<T>(opts: Opts | undefined, fn: (tx: any) => Promise<T>): Promise<T> {
  if (opts?.tx) return fn(opts.tx);
  return (prisma as any).$transaction(fn, { timeout: 20000 }) as Promise<T>;
}

function canAct(actor: Actor, companyId: number | null | undefined): boolean {
  if (actor.scope.platform) return true;
  if (companyId == null) return false;
  return Array.from(actor.scope.companyIds as Iterable<number>).includes(companyId);
}

const ESEL = {
  id: true,
  shipmentId: true,
  providerId: true,
  companyId: true,
  idempotencyKey: true,
  active: true,
  externalId: true,
  trackingNumber: true,
  status: true,
  rawStatus: true,
  submitState: true,
  attempts: true,
  nextRetryAt: true,
  lastError: true,
  submittedAt: true,
  lastEventAt: true,
  finalAt: true,
  createdAt: true,
  updatedAt: true,
  provider: { select: { id: true, code: true, name: true } },
} as const;

export type RecordEventInput = {
  providerId: number;
  externalShipmentId?: number;
  externalId?: string;
  trackingNumber?: string;
  rawStatus: string;
  occurredAt: Date;
  eventId?: string;
  source: "WEBHOOK" | "POLL" | "MANUAL" | "CSV";
  canonicalOverride?: string;
  payload?: unknown;
};

async function claimAndSubmit(actorId: number | null, esId: number, opts?: Opts): Promise<{ claimed: boolean; es: any }> {
  const db = opts?.tx ?? (prisma as any);
  const staleBefore = new Date(Date.now() - SUBMITTING_STALE_MS);
  const claimed = await run(opts, async (tx) => {
    const r = await tx.externalShipment.updateMany({
      where: {
        id: esId,
        active: true,
        OR: [{ submitState: { in: ["NOT_SUBMITTED", "FAILED"] } }, { submitState: "SUBMITTING", updatedAt: { lt: staleBefore } }],
      },
      data: { submitState: "SUBMITTING", attempts: { increment: 1 }, nextRetryAt: null },
    });
    return r.count === 1;
  });
  if (!claimed) return { claimed: false, es: await db.externalShipment.findUnique({ where: { id: esId }, select: ESEL }) };

  const es = await db.externalShipment.findUnique({ where: { id: esId }, select: { ...ESEL, payload: true } });
  const provider = await db.shippingProvider.findUnique({
    where: { id: es.providerId },
    select: { id: true, code: true, integrationType: true, status: true, baseUrl: true, authScheme: true, capabilities: true, credentialsEnc: true, config: true },
  });
  const t0 = Date.now();
  let res: AdapterResult<CreateShipmentData>;
  try {
    if (!provider || provider.status !== "ACTIVE") {
      res = { ok: false, error: "مزوّد التوصيل غير مفعّل", retryable: false };
    } else {
      const credentials = provider.credentialsEnc ? openJson<Record<string, string>>("credentials", "provider:" + provider.id, provider.credentialsEnc) : {};
      res = await getAdapter(provider.integrationType).createShipment(
        {
          provider: { id: provider.id, code: provider.code, integrationType: provider.integrationType, baseUrl: provider.baseUrl, authScheme: provider.authScheme, capabilities: provider.capabilities, config: provider.config },
          credentials,
          idempotencyKey: es.idempotencyKey,
        },
        es.payload as ExternalShipmentPayload
      );
    }
  } catch (e) {
    res = { ok: false, error: e instanceof Error ? e.message : "خطأ غير متوقع", retryable: true };
  }
  const ms = Date.now() - t0;

  await run(opts, async (tx) => {
    let success = res.ok;
    let error: string | null = res.ok ? null : res.error;
    let retryable = res.ok ? false : res.retryable;
    if (res.ok && res.data.externalId) {
      const dup = await tx.externalShipment.findFirst({ where: { providerId: es.providerId, externalId: res.data.externalId, NOT: { id: es.id } }, select: { id: true } });
      if (dup) { success = false; error = "معرّف خارجي مكرر"; retryable = false; }
    }
    if (success && res.ok) {
      await tx.externalShipment.updateMany({
        where: { id: es.id, submitState: "SUBMITTING" },
        data: {
          submitState: res.data.manual ? "MANUAL" : "SUBMITTED",
          status: res.data.manual ? "PENDING_DISPATCH" : "SUBMITTED",
          externalId: res.data.externalId ?? null,
          trackingNumber: res.data.trackingNumber ?? null,
          response: (compactForLog(res.data.raw ?? res.data) ?? undefined) as any,
          submittedAt: new Date(),
          lastError: null,
          nextRetryAt: null,
        },
      });
    } else {
      const delay = retryable ? nextRetryDelayMs(es.attempts) : null;
      await tx.externalShipment.updateMany({
        where: { id: es.id, submitState: "SUBMITTING" },
        data: { submitState: "FAILED", lastError: String(error ?? "فشل غير معروف").slice(0, 500), nextRetryAt: delay ? new Date(Date.now() + delay) : null },
      });
    }
    await logIntegration(tx, {
      providerId: es.providerId,
      externalShipmentId: es.id,
      direction: "OUTBOUND",
      operation: "CREATE_SHIPMENT",
      ok: success,
      httpStatus: res.httpStatus ?? null,
      durationMs: ms,
      request: es.payload,
      response: res.ok ? res.data : null,
      error: success ? null : error,
    });
    if (actorId) {
      await logLogisticsAudit(tx, { userId: actorId, action: "LOGISTICS_EXTERNAL_DISPATCH", entityType: "ExternalShipment", entityId: es.id, after: { ok: success, attempts: es.attempts } });
    }
  });
  return { claimed: true, es: await db.externalShipment.findUnique({ where: { id: esId }, select: ESEL }) };
}

async function resolveEs(tx: any, input: RecordEventInput): Promise<{ id: number } | null> {
  if (input.externalShipmentId) return tx.externalShipment.findFirst({ where: { id: input.externalShipmentId, providerId: input.providerId }, select: { id: true } });
  if (input.externalId) return tx.externalShipment.findFirst({ where: { providerId: input.providerId, externalId: input.externalId }, select: { id: true } });
  if (input.trackingNumber) return tx.externalShipment.findFirst({ where: { providerId: input.providerId, trackingNumber: input.trackingNumber, active: true }, select: { id: true } });
  return null;
}

export const ExternalShipmentService = {
  async dispatch(actor: Actor, input: DispatchInput, opts?: Opts): Promise<any> {
    let prep: { es: any; created: boolean };
    try {
      prep = await run(opts, async (tx) => {
        const sh = await tx.shipment.findUnique({
          where: { id: input.shipmentId },
          select: {
            id: true, shipmentNumber: true, status: true, deliveryPersonId: true, totalCOD: true, companyId: true,
            items: { select: { order: { select: { orderNumber: true, shippingAddressSnapshot: true, customerSnapshot: true } } } },
          },
        });
        if (!sh) throw new LogisticsError("الشحنة غير موجودة", 404);
        if (!canAct(actor, sh.companyId)) throw new LogisticsError("ليست لديك صلاحية على هذه الشحنة", 403);
        const provider = await tx.shippingProvider.findUnique({ where: { id: input.providerId }, select: { id: true, status: true } });
        if (!provider) throw new LogisticsError("شركة التوصيل غير موجودة", 404);
        if (provider.status !== "ACTIVE") throw new LogisticsError("شركة التوصيل غير مفعّلة", 409);
        const existing = await tx.externalShipment.findFirst({ where: { shipmentId: sh.id, active: true }, select: ESEL });
        if (existing) {
          if (existing.providerId !== provider.id) throw new LogisticsError("الشحنة مرتبطة بشركة توصيل أخرى", 409);
          return { es: existing, created: false };
        }
        if (sh.deliveryPersonId) throw new LogisticsError("الشحنة مُسندة لسائق داخلي", 409);
        if (sh.status !== "READY") throw new LogisticsError("الشحنة غير جاهزة للإرسال", 409);
        const seen = new Set<string>();
        const orders: { orderNumber: string; address: any; customer: any }[] = [];
        for (const it of sh.items) {
          if (seen.has(it.order.orderNumber)) continue;
          seen.add(it.order.orderNumber);
          orders.push({ orderNumber: it.order.orderNumber, address: it.order.shippingAddressSnapshot, customer: it.order.customerSnapshot });
        }
        let payload: ExternalShipmentPayload;
        try {
          payload = buildShipmentPayload({ shipmentNumber: sh.shipmentNumber, totalCOD: Number(sh.totalCOD), orders });
        } catch (e) {
          if (e instanceof TransformError) throw new LogisticsError(e.message, 422);
          throw e;
        }
        const seq = (await tx.externalShipment.count({ where: { shipmentId: sh.id, providerId: provider.id } })) + 1;
        const es = await tx.externalShipment.create({
          data: {
            shipmentId: sh.id,
            providerId: provider.id,
            companyId: sh.companyId,
            idempotencyKey: newIdempotencyKey(sh.id, provider.id, seq),
            payload: payload as any,
            createdById: actor.id,
          },
          select: ESEL,
        });
        return { es, created: true };
      });
    } catch (e: any) {
      if (!opts?.tx && e?.code === "P2002") {
        const ex = await (prisma as any).externalShipment.findFirst({ where: { shipmentId: input.shipmentId, active: true }, select: ESEL });
        if (ex) return { external: ex, duplicate: true };
      }
      throw e;
    }
    if (!prep.created && ["SUBMITTED", "MANUAL"].includes(prep.es.submitState)) return { external: prep.es, duplicate: true };
    const r = await claimAndSubmit(actor.id, prep.es.id, opts);
    return { external: r.es, duplicate: !prep.created && !r.claimed };
  },

  async retry(actor: Actor, id: number, opts?: Opts) {
    const db = opts?.tx ?? (prisma as any);
    const es = await db.externalShipment.findUnique({ where: { id }, select: { id: true, companyId: true } });
    if (!es) throw new LogisticsError("الشحنة الخارجية غير موجودة", 404);
    if (!canAct(actor, es.companyId)) throw new LogisticsError("ليست لديك صلاحية", 403);
    const r = await claimAndSubmit(actor.id, id, opts);
    if (!r.claimed) throw new LogisticsError("الشحنة قيد الإرسال أو أُرسلت بالفعل", 409);
    return { external: r.es };
  },

  /** مسح دوري: يعيد إرسال المحاولات المستحقة (بدون مستخدم). */
  async retryDue(limit = 20, opts?: Opts) {
    const db = opts?.tx ?? (prisma as any);
    const now = new Date();
    const rows = await db.externalShipment.findMany({
      where: {
        active: true,
        provider: { status: "ACTIVE" },
        OR: [
          { submitState: "FAILED", nextRetryAt: { lte: now } },
          { submitState: "SUBMITTING", updatedAt: { lt: new Date(now.getTime() - SUBMITTING_STALE_MS) } },
        ],
      },
      orderBy: { nextRetryAt: "asc" },
      take: limit,
      select: { id: true },
    });
    let processed = 0;
    let errors = 0;
    for (const r of rows) {
      try {
        const c = await claimAndSubmit(null, r.id, opts);
        if (c.claimed) processed++;
      } catch {
        errors++;
      }
    }
    return { found: rows.length, processed, errors };
  },

  /** المعالج الموحّد للأحداث الواردة (webhook / polling / يدوي / CSV). */
  async recordEvent(input: RecordEventInput, opts?: Opts): Promise<{ outcome: string; reason?: string; externalShipmentId?: number; status?: string }> {
    return run(opts, async (tx) => {
      const found = await resolveEs(tx, input);
      if (!found) return { outcome: "NOT_FOUND" };
      await tx.$queryRaw`SELECT "id" FROM "ExternalShipment" WHERE "id" = ${found.id} FOR UPDATE`;
      const es = await tx.externalShipment.findUnique({ where: { id: found.id }, select: { id: true, providerId: true, status: true, lastEventAt: true, externalId: true } });
      const eventId = input.eventId ?? deriveEventId({ providerId: input.providerId, externalId: es.externalId ?? String(es.id), rawStatus: input.rawStatus, occurredAt: input.occurredAt });
      const dup = await tx.externalShipmentEvent.findUnique({ where: { providerId_eventId: { providerId: input.providerId, eventId } }, select: { id: true } });
      if (dup) return { outcome: "DUPLICATE", externalShipmentId: es.id };

      let canonical: string | null = input.canonicalOverride ?? null;
      if (!canonical) {
        const m = await tx.providerStatusMapping.findUnique({
          where: { providerId_externalStatus: { providerId: input.providerId, externalStatus: normalizeExternalStatus(input.rawStatus) } },
          select: { canonicalStatus: true },
        });
        canonical = m?.canonicalStatus ?? null;
      }
      let applied = false;
      let reason: string | null = null;
      if (!canonical) {
        reason = "UNMAPPED";
        await tx.externalShipment.updateMany({ where: { id: es.id }, data: { rawStatus: input.rawStatus } });
      } else {
        const d = decideEvent({ status: es.status, lastEventAt: es.lastEventAt }, { canonical, occurredAt: input.occurredAt });
        if (!d.apply) reason = d.reason;
        else {
          await tx.externalShipment.update({
            where: { id: es.id },
            data: { status: canonical as any, rawStatus: input.rawStatus, lastEventAt: input.occurredAt, lastEventId: eventId, ...(isFinalStatus(canonical) ? { finalAt: new Date() } : {}) },
          });
          applied = true;
        }
      }
      const created = await tx.externalShipmentEvent.createMany({
        data: [
          {
            externalShipmentId: es.id,
            providerId: input.providerId,
            eventId,
            rawStatus: input.rawStatus,
            canonicalStatus: (canonical as any) ?? null,
            occurredAt: input.occurredAt,
            source: input.source,
            applied,
            ignoredReason: reason,
            payload: input.payload == null ? undefined : (compactForLog(input.payload) as any),
          },
        ],
        skipDuplicates: true,
      });
      if (created.count === 0) throw new LogisticsError("حدث مكرر", 409);
      await logIntegration(tx, { providerId: input.providerId, externalShipmentId: es.id, direction: "INBOUND", operation: "EVENT", ok: true, request: { rawStatus: input.rawStatus, source: input.source }, response: { applied, reason } });
      return { outcome: applied ? "APPLIED" : reason === "UNMAPPED" ? "UNMAPPED" : "IGNORED", reason: reason ?? undefined, externalShipmentId: es.id, status: applied ? (canonical as string) : es.status };
    });
  },

  async addManualEvent(actor: Actor, id: number, a: { rawStatus: string; canonicalStatus?: string; occurredAt?: string }, opts?: Opts) {
    return run(opts, async (tx) => {
      const es = await tx.externalShipment.findUnique({ where: { id }, select: { id: true, providerId: true, companyId: true } });
      if (!es) throw new LogisticsError("الشحنة الخارجية غير موجودة", 404);
      if (!canAct(actor, es.companyId)) throw new LogisticsError("ليست لديك صلاحية", 403);
      const at = a.occurredAt ? new Date(a.occurredAt) : new Date();
      if (Number.isNaN(at.getTime()) || at.getTime() > Date.now() + 5 * 60000) throw new LogisticsError("وقت الحدث غير صالح", 400);
      const r = await ExternalShipmentService.recordEvent(
        { providerId: es.providerId, externalShipmentId: es.id, rawStatus: a.rawStatus, occurredAt: at, source: "MANUAL", canonicalOverride: a.canonicalStatus },
        { tx }
      );
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_EXTERNAL_EVENT", entityType: "ExternalShipment", entityId: id, after: { rawStatus: a.rawStatus, outcome: r.outcome } });
      return r;
    });
  },

  async setTracking(actor: Actor, id: number, a: { trackingNumber?: string; externalId?: string }, opts?: Opts) {
    if (!a.trackingNumber && !a.externalId) throw new LogisticsError("أدخل رقم تتبع أو معرّفاً خارجياً", 400);
    return run(opts, async (tx) => {
      const es = await tx.externalShipment.findUnique({ where: { id }, select: { id: true, providerId: true, companyId: true, submitState: true, trackingNumber: true, externalId: true } });
      if (!es) throw new LogisticsError("الشحنة الخارجية غير موجودة", 404);
      if (!canAct(actor, es.companyId)) throw new LogisticsError("ليست لديك صلاحية", 403);
      if (!["MANUAL", "SUBMITTED"].includes(es.submitState)) throw new LogisticsError("لا يمكن إدخال التتبع قبل الإرسال", 409);
      if (a.externalId) {
        const dup = await tx.externalShipment.findFirst({ where: { providerId: es.providerId, externalId: a.externalId, NOT: { id } }, select: { id: true } });
        if (dup) throw new LogisticsError("المعرّف الخارجي مستخدم في شحنة أخرى", 409);
      }
      await tx.externalShipment.update({ where: { id }, data: { ...(a.trackingNumber ? { trackingNumber: a.trackingNumber } : {}), ...(a.externalId ? { externalId: a.externalId } : {}) } });
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_EXTERNAL_TRACKING", entityType: "ExternalShipment", entityId: id, before: { trackingNumber: es.trackingNumber, externalId: es.externalId }, after: a });
      return { external: await tx.externalShipment.findUnique({ where: { id }, select: ESEL }) };
    });
  },

  async act(actor: Actor, id: number, a: ExternalAction, opts?: Opts): Promise<any> {
    if (a.action === "retry") return ExternalShipmentService.retry(actor, id, opts);
    if (a.action === "set_tracking") return ExternalShipmentService.setTracking(actor, id, a, opts);
    return { event: await ExternalShipmentService.addManualEvent(actor, id, a, opts) };
  },

  async list(actor: Actor, f: { providerId?: number; status?: string; submitState?: string; take?: number }, opts?: Opts) {
    const db = opts?.tx ?? (prisma as any);
    const where: any = { active: true };
    if (!actor.scope.platform) where.companyId = { in: Array.from(actor.scope.companyIds as Iterable<number>) };
    if (f.providerId) where.providerId = f.providerId;
    if (f.status) where.status = f.status;
    if (f.submitState) where.submitState = f.submitState;
    return db.externalShipment.findMany({ where, orderBy: { id: "desc" }, take: Math.min(f.take ?? 100, 200), select: ESEL });
  },

  async get(actor: Actor, id: number, opts?: Opts) {
    const db = opts?.tx ?? (prisma as any);
    const es = await db.externalShipment.findUnique({ where: { id }, select: { ...ESEL, payload: true, response: true } });
    if (!es) throw new LogisticsError("الشحنة الخارجية غير موجودة", 404);
    if (!canAct(actor, es.companyId)) throw new LogisticsError("ليست لديك صلاحية", 403);
    const events = await db.externalShipmentEvent.findMany({ where: { externalShipmentId: id }, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], take: 100 });
    const logs = await db.integrationLog.findMany({ where: { externalShipmentId: id }, orderBy: { id: "desc" }, take: 30 });
    return { external: es, events, logs };
  },

  async health(actor: Actor, opts?: Opts) {
    if (!actor.scope.platform) throw new LogisticsError("هذه العملية للأدمن فقط", 403);
    const db = opts?.tx ?? (prisma as any);
    const now = new Date();
    const staleBefore = new Date(now.getTime() - SUBMITTING_STALE_MS);
    const silentBefore = new Date(now.getTime() - 48 * 3600 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
    const [bySubmit, failedStuck, retryDue, stuckSubmitting, silent, logsAll, logsOk] = await Promise.all([
      db.externalShipment.groupBy({ by: ["submitState"], where: { active: true }, _count: { _all: true } }),
      db.externalShipment.count({ where: { active: true, submitState: "FAILED", nextRetryAt: null } }),
      db.externalShipment.count({ where: { active: true, submitState: "FAILED", nextRetryAt: { lte: now } } }),
      db.externalShipment.count({ where: { active: true, submitState: "SUBMITTING", updatedAt: { lt: staleBefore } } }),
      db.externalShipment.count({ where: { active: true, submitState: "SUBMITTED", status: "SUBMITTED", lastEventAt: null, submittedAt: { lt: silentBefore } } }),
      db.integrationLog.groupBy({ by: ["providerId"], where: { createdAt: { gte: dayAgo } }, _count: { _all: true } }),
      db.integrationLog.groupBy({ by: ["providerId"], where: { createdAt: { gte: dayAgo }, ok: true }, _count: { _all: true } }),
    ]);
    const okMap = new Map<number, number>(logsOk.map((r: any) => [r.providerId, r._count._all]));
    return {
      generatedAt: now.toISOString(),
      bySubmitState: Object.fromEntries(bySubmit.map((r: any) => [r.submitState, r._count._all])),
      failedNeedsAttention: failedStuck,
      retryDue,
      stuckSubmitting,
      silentOver48h: silent,
      providers24h: logsAll.map((r: any) => ({ providerId: r.providerId, total: r._count._all, ok: okMap.get(r.providerId) ?? 0 })),
    };
  },
};