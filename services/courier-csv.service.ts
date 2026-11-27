/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { ExternalShipmentService } from "@/services/external-shipment.service";
import { normalizeExternalStatus } from "@/lib/integration-status";
import { parseCsv, toCsv, detectColumns, parseTimeCell, EXPORT_HEADERS } from "@/lib/integration-csv";
import { LogisticsError } from "@/lib/logistics-errors";
import type { Actor } from "@/services/logistics-admin.service";

type Opts = { tx?: any };
const FINAL = ["DELIVERED", "RETURNED", "CANCELLED"];
export const MAX_IMPORT_ROWS = 300;

function canSee(actor: Actor, companyId: number | null | undefined): boolean {
  if (actor.scope.platform) return true;
  if (companyId == null) return false;
  return Array.from(actor.scope.companyIds as Iterable<number>).includes(companyId);
}

async function loadFileProvider(db: any, id: number) {
  const p = await db.shippingProvider.findUnique({ where: { id }, select: { id: true, code: true, name: true, integrationType: true } });
  if (!p) throw new LogisticsError("شركة التوصيل غير موجودة", 404);
  if (p.integrationType !== "CSV" && p.integrationType !== "MANUAL") {
    throw new LogisticsError("الاستيراد والتصدير بالملفات لشركات CSV أو اليدوي فقط (شركات API تستعمل Webhook)", 409);
  }
  return p;
}

export type CsvImportResult = {
  total: number;
  counts: Record<string, number>;
  notFound: number;
  trackingUpdated: number;
  errors: { line: number; ref: string; message: string }[];
};

export const CourierCsvService = {
  async export(actor: Actor, providerId: number, opts?: Opts) {
    const db = (opts?.tx ?? prisma) as any;
    const p = await loadFileProvider(db, providerId);
    const where: any = { providerId, active: true, submitState: "MANUAL", status: { notIn: FINAL } };
    if (!actor.scope.platform) where.companyId = { in: Array.from(actor.scope.companyIds as Iterable<number>) };
    const rows = await db.externalShipment.findMany({
      where,
      orderBy: { id: "asc" },
      take: 2000,
      select: { id: true, shipmentId: true, trackingNumber: true, status: true, payload: true },
    });
    const table: (string | number | null)[][] = [Array.from(EXPORT_HEADERS)];
    for (const r of rows) {
      const pl: any = r.payload ?? {};
      const rc = pl.recipient ?? {};
      table.push([
        pl.reference ?? "",
        Array.isArray(pl.orderNumbers) ? pl.orderNumbers.join(" ") : "",
        rc.name ?? "",
        rc.phone ?? "",
        rc.city ?? "",
        rc.district ?? "",
        rc.address ?? "",
        pl.cod ?? 0,
        pl.currency ?? "MAD",
        pl.parcels ?? 1,
        pl.notes ?? "",
        r.shipmentId,
        r.trackingNumber ?? "",
        r.status,
      ]);
    }
    const day = new Date().toISOString().slice(0, 10);
    return { filename: "shipments-" + p.code + "-" + day + ".csv", csv: toCsv(table), count: rows.length };
  },

  async import(actor: Actor, providerId: number, csv: string, opts?: Opts): Promise<CsvImportResult> {
    const db = (opts?.tx ?? prisma) as any;
    await loadFileProvider(db, providerId);
    const rows = parseCsv(csv);
    if (rows.length < 2) throw new LogisticsError("الملف فارغ أو بلا صفوف بيانات", 400);
    const cols = detectColumns(rows[0]);
    if (cols.status < 0 && cols.tracking < 0) throw new LogisticsError("لم أجد عمود الحالة أو التتبع. العناوين المقبولة: reference, tracking, status, date", 400);
    if (cols.reference < 0 && cols.tracking < 0) throw new LogisticsError("لم أجد عمود المرجع (reference) أو رقم التتبع", 400);
    const data = rows.slice(1);
    if (data.length > MAX_IMPORT_ROWS) throw new LogisticsError("الحد الأقصى " + MAX_IMPORT_ROWS + " صفاً في المرة الواحدة. قسّم الملف.", 400);

    const all = await db.externalShipment.findMany({
      where: { providerId, active: true },
      take: 5000,
      select: { id: true, companyId: true, externalId: true, trackingNumber: true, payload: true },
    });
    const index = new Map<string, any[]>();
    const add = (k: unknown, es: any) => {
      const key = String(k ?? "").trim().toLowerCase();
      if (!key) return;
      const arr = index.get(key) ?? [];
      if (!arr.includes(es)) arr.push(es);
      index.set(key, arr);
    };
    for (const es of all) {
      add((es.payload as any)?.reference, es);
      add(es.trackingNumber, es);
      add(es.externalId, es);
    }

    const out: CsvImportResult = { total: data.length, counts: {}, notFound: 0, trackingUpdated: 0, errors: [] };
    const err = (line: number, ref: string, message: string) => {
      if (out.errors.length < 50) out.errors.push({ line, ref, message });
    };
    const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      const line = i + 2;
      const ref = cell(r, cols.reference);
      const trk = cell(r, cols.tracking);
      const st = cell(r, cols.status);
      const tm = cell(r, cols.time);
      const key = (ref || trk).toLowerCase();
      if (!key) {
        err(line, "", "صف بلا مرجع ولا رقم تتبع");
        continue;
      }
      const hit = index.get(ref.toLowerCase()) ?? (trk ? index.get(trk.toLowerCase()) : undefined) ?? [];
      const visible = hit.filter((es) => canSee(actor, es.companyId));
      if (visible.length === 0) {
        out.notFound++;
        err(line, ref || trk, "لا توجد شحنة مطابقة لهذه الشركة");
        continue;
      }
      if (visible.length > 1) {
        err(line, ref || trk, "أكثر من شحنة مطابقة");
        continue;
      }
      const es = visible[0];
      try {
        if (trk && es.trackingNumber !== trk) {
          await ExternalShipmentService.setTracking(actor, es.id, { trackingNumber: trk }, opts as any);
          es.trackingNumber = trk;
          out.trackingUpdated++;
        }
        if (st) {
          const when = tm ? parseTimeCell(tm) : null;
          const occurredAt = when ?? new Date();
          const eventId = createHash("sha256")
            .update([providerId, es.id, normalizeExternalStatus(st), when ? when.toISOString() : "-"].join("|"))
            .digest("hex");
          const ev = await ExternalShipmentService.recordEvent(
            { providerId, externalShipmentId: es.id, rawStatus: st, occurredAt, eventId, source: "CSV" },
            opts as any
          );
          out.counts[ev.outcome] = (out.counts[ev.outcome] ?? 0) + 1;
        }
      } catch (e: any) {
        err(line, ref || trk, String(e?.message ?? "خطأ غير معروف").slice(0, 200));
      }
    }
    return out;
  },
};