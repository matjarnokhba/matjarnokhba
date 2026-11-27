/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { openJson } from "@/lib/integration-crypto";
import { logIntegration } from "@/lib/integration-log";
import { getAdapter } from "@/lib/courier-adapter";
import { normalizeExternalStatus } from "@/lib/integration-status";
import { ExternalShipmentService } from "@/services/external-shipment.service";

type Opts = { tx?: any };

export const CourierPollService = {
  /** استعلام التتبع للشحنات غير النهائية لدى المزوّدين الذين يدعمون TRACKING_API. */
  async pollTracking(limit = 30, opts?: Opts) {
    const db = opts?.tx ?? (prisma as any);
    const rows = await db.externalShipment.findMany({
      where: {
        active: true,
        submitState: "SUBMITTED",
        status: { notIn: ["DELIVERED", "RETURNED", "CANCELLED"] },
        OR: [{ externalId: { not: null } }, { trackingNumber: { not: null } }],
        provider: { status: "ACTIVE", integrationType: "API", capabilities: { has: "TRACKING_API" } },
      },
      orderBy: { updatedAt: "asc" },
      take: limit,
      select: {
        id: true,
        providerId: true,
        externalId: true,
        trackingNumber: true,
        rawStatus: true,
        provider: { select: { id: true, code: true, integrationType: true, baseUrl: true, authScheme: true, capabilities: true, credentialsEnc: true, config: true } },
      },
    });
    let polled = 0;
    let recorded = 0;
    let errors = 0;
    for (const r of rows) {
      try {
        const p = r.provider;
        const adapter = getAdapter(p.integrationType);
        if (!adapter.getStatus) continue;
        const credentials = p.credentialsEnc ? openJson<Record<string, string>>("credentials", "provider:" + p.id, p.credentialsEnc) : {};
        const t0 = Date.now();
        const res = await adapter.getStatus(
          { provider: { id: p.id, code: p.code, integrationType: p.integrationType, baseUrl: p.baseUrl, authScheme: p.authScheme, capabilities: p.capabilities, config: p.config }, credentials },
          { externalId: r.externalId, trackingNumber: r.trackingNumber }
        );
        polled++;
        await logIntegration(db, { providerId: p.id, externalShipmentId: r.id, direction: "OUTBOUND", operation: "POLL", ok: res.ok, httpStatus: res.httpStatus ?? null, durationMs: Date.now() - t0, error: res.ok ? null : res.error });
        await db.externalShipment.updateMany({ where: { id: r.id }, data: { lastError: res.ok ? null : String(res.error).slice(0, 500) } });
        if (!res.ok) { errors++; continue; }
        if (normalizeExternalStatus(res.data.rawStatus) === normalizeExternalStatus(r.rawStatus ?? "")) continue;
        await ExternalShipmentService.recordEvent({ providerId: p.id, externalShipmentId: r.id, rawStatus: res.data.rawStatus, occurredAt: res.data.occurredAt ?? new Date(), source: "POLL" }, opts);
        recorded++;
      } catch {
        errors++;
      }
    }
    return { found: rows.length, polled, recorded, errors };
  },
};