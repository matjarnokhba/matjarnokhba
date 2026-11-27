import { createHmac, timingSafeEqual } from "crypto";
import { getPath } from "@/lib/integration-config";

export type WebhookCfg = {
  eventsPath?: string;
  eventIdPath?: string;
  externalIdPath?: string;
  trackingPath?: string;
  statusPath?: string;
  timePath?: string;
} | undefined;

export type ParsedEvent = { eventId?: string; externalId?: string; trackingNumber?: string; rawStatus: string; occurredAt: Date; raw: unknown };

const TOLERANCE_MS = 10 * 60 * 1000;

function parseTs(ts: string): number {
  const n = Number(ts);
  if (Number.isFinite(n) && ts.trim() !== "") return n < 1e12 ? n * 1000 : n;
  return Date.parse(ts);
}

function safeEq(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function verifySignature(p: {
  secret: string;
  rawBody: string;
  signature: string | null;
  timestamp?: string | null;
  requireTimestamp?: boolean;
  now?: number;
}): { ok: true } | { ok: false; reason: string } {
  if (!p.signature) return { ok: false, reason: "MISSING_SIGNATURE" };
  let signed = p.rawBody;
  if (p.requireTimestamp) {
    if (!p.timestamp) return { ok: false, reason: "MISSING_TIMESTAMP" };
    const t = parseTs(p.timestamp);
    if (!Number.isFinite(t) || Math.abs((p.now ?? Date.now()) - t) > TOLERANCE_MS) return { ok: false, reason: "STALE_TIMESTAMP" };
    signed = p.timestamp + "." + p.rawBody;
  }
  const sig = p.signature.trim().replace(/^sha256=/i, "");
  const h = createHmac("sha256", p.secret).update(signed).digest();
  if (safeEq(sig.toLowerCase(), h.toString("hex")) || safeEq(sig, h.toString("base64")) || safeEq(sig, h.toString("base64url"))) return { ok: true };
  return { ok: false, reason: "BAD_SIGNATURE" };
}

/** وقت الحدث: ثوانٍ/ميلي ثانية/ISO؛ غير صالح أو في المستقبل البعيد = الآن. */
export function parseEventTime(v: unknown, now = Date.now()): Date {
  let t = NaN;
  if (typeof v === "number") t = v < 1e12 ? v * 1000 : v;
  else if (typeof v === "string" && v.trim() !== "") t = parseTs(v.trim());
  if (!Number.isFinite(t) || t > now + 5 * 60000 || t < 946684800000) return new Date(now);
  return new Date(t);
}

const str = (v: unknown): string | undefined => {
  if (typeof v === "string" && v.trim()) return v.trim().slice(0, 200);
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
};

export function extractEvents(cfg: WebhookCfg, body: unknown, now = Date.now()): ParsedEvent[] {
  const statusPath = cfg?.statusPath ?? "status";
  const items0 = cfg?.eventsPath ? getPath(body, cfg.eventsPath) : body;
  const items: unknown[] = Array.isArray(items0) ? items0 : items0 && typeof items0 === "object" ? [items0] : [];
  const out: ParsedEvent[] = [];
  for (const it of items.slice(0, 50)) {
    const rawStatus = str(getPath(it, statusPath));
    if (!rawStatus) continue;
    out.push({
      eventId: str(getPath(it, cfg?.eventIdPath ?? "eventId")),
      externalId: str(getPath(it, cfg?.externalIdPath ?? "externalId")),
      trackingNumber: str(getPath(it, cfg?.trackingPath ?? "trackingNumber")),
      rawStatus,
      occurredAt: parseEventTime(getPath(it, cfg?.timePath ?? "occurredAt"), now),
      raw: it,
    });
  }
  return out;
}