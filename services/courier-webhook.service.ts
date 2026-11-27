/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { LogisticsError } from "@/lib/logistics-errors";
import { openJson } from "@/lib/integration-crypto";
import { logIntegration } from "@/lib/integration-log";
import { httpConfigSchema } from "@/lib/integration-config";
import { extractEvents, verifySignature } from "@/lib/integration-webhook";
import { ExternalShipmentService } from "@/services/external-shipment.service";

type Opts = { tx?: any };

export const CourierWebhookService = {
  async handle(token: string, rawBody: string, header: (name: string) => string | null, opts?: Opts): Promise<{ status: number; body: Record<string, unknown> }> {
    const db = opts?.tx ?? (prisma as any);
    const p = await db.shippingProvider.findUnique({ where: { webhookToken: token }, select: { id: true, status: true, webhookSecretEnc: true, config: true } });
    if (!p) return { status: 404, body: { success: false } };
    if (!["ACTIVE", "TESTING"].includes(p.status)) return { status: 403, body: { success: false } };

    const parsed = httpConfigSchema.safeParse(p.config);
    const wcfg = parsed.success ? parsed.data.webhook : undefined;
    let secret: string;
    try {
      secret = openJson<{ secret: string }>("webhook", "provider:" + p.id, p.webhookSecretEnc).secret;
    } catch {
      return { status: 401, body: { success: false } };
    }
    const tsName = wcfg?.timestampHeader;
    const v = verifySignature({
      secret,
      rawBody,
      signature: header(wcfg?.signatureHeader ?? "x-signature"),
      timestamp: tsName ? header(tsName) : undefined,
      requireTimestamp: !!tsName,
    });
    if (!v.ok) {
      await logIntegration(db, { providerId: p.id, direction: "INBOUND", operation: "WEBHOOK_REJECTED", ok: false, error: v.reason });
      return { status: 401, body: { success: false } };
    }
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      await logIntegration(db, { providerId: p.id, direction: "INBOUND", operation: "WEBHOOK_BAD_JSON", ok: false, error: "JSON غير صالح" });
      return { status: 400, body: { success: false, message: "JSON غير صالح" } };
    }
    const events = extractEvents(wcfg, json);
    const results = { received: events.length, applied: 0, duplicate: 0, ignored: 0, unmapped: 0, notFound: 0 };
    for (const ev of events) {
      try {
        const r = await ExternalShipmentService.recordEvent(
          { providerId: p.id, externalId: ev.externalId, trackingNumber: ev.trackingNumber, rawStatus: ev.rawStatus, occurredAt: ev.occurredAt, eventId: ev.eventId, source: "WEBHOOK", payload: ev.raw },
          opts
        );
        if (r.outcome === "APPLIED") results.applied++;
        else if (r.outcome === "DUPLICATE") results.duplicate++;
        else if (r.outcome === "UNMAPPED") results.unmapped++;
        else if (r.outcome === "NOT_FOUND") results.notFound++;
        else results.ignored++;
      } catch (e) {
        if (e instanceof LogisticsError && e.status === 409) results.duplicate++;
        else throw e;
      }
    }
    await logIntegration(db, { providerId: p.id, direction: "INBOUND", operation: "WEBHOOK", ok: true, request: { events: events.length }, response: results });
    return { status: 200, body: { success: true, results } };
  },
};