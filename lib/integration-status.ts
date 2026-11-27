import { createHash } from "crypto";

export const CANONICAL_STATUSES = [
  "PENDING_DISPATCH",
  "SUBMITTED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED_ATTEMPT",
  "RETURNING",
  "RETURNED",
  "CANCELLED",
  "EXCEPTION",
] as const;
export type CanonicalStatus = (typeof CANONICAL_STATUSES)[number];

export const FINAL_STATUSES: readonly string[] = ["DELIVERED", "RETURNED", "CANCELLED"];
export function isFinalStatus(s: string): boolean {
  return FINAL_STATUSES.includes(s);
}

export const CANONICAL_LABEL: Record<string, string> = {
  PENDING_DISPATCH: "بانتظار الإرسال",
  SUBMITTED: "مُرسلة للشركة",
  PICKED_UP: "تم الاستلام من المرسل",
  IN_TRANSIT: "في الطريق",
  OUT_FOR_DELIVERY: "خرجت للتوصيل",
  DELIVERED: "تم التسليم",
  FAILED_ATTEMPT: "محاولة فاشلة",
  RETURNING: "قيد الإرجاع",
  RETURNED: "تم الإرجاع",
  CANCELLED: "ملغاة",
  EXCEPTION: "استثناء/مشكلة",
};

/** توحيد نص حالة الشركة قبل البحث في جدول الربط. */
export function normalizeExternalStatus(raw: string): string {
  return raw.normalize("NFKC").trim().toLowerCase().replace(/[\s_\-]+/g, " ");
}

export const DEFAULT_STATUS_MAP: Record<string, CanonicalStatus> = {
  created: "SUBMITTED",
  new: "SUBMITTED",
  accepted: "SUBMITTED",
  confirmed: "SUBMITTED",
  submitted: "SUBMITTED",
  "en attente": "SUBMITTED",
  "تم الاستلام": "SUBMITTED",
  "picked up": "PICKED_UP",
  pickup: "PICKED_UP",
  collected: "PICKED_UP",
  ramassé: "PICKED_UP",
  "pris en charge": "PICKED_UP",
  "in transit": "IN_TRANSIT",
  "en transit": "IN_TRANSIT",
  shipped: "IN_TRANSIT",
  dispatched: "IN_TRANSIT",
  expédié: "IN_TRANSIT",
  "في الطريق": "IN_TRANSIT",
  "out for delivery": "OUT_FOR_DELIVERY",
  "en cours de livraison": "OUT_FOR_DELIVERY",
  "en livraison": "OUT_FOR_DELIVERY",
  "خرج للتوصيل": "OUT_FOR_DELIVERY",
  delivered: "DELIVERED",
  livré: "DELIVERED",
  livrée: "DELIVERED",
  "تم التسليم": "DELIVERED",
  failed: "FAILED_ATTEMPT",
  "failed attempt": "FAILED_ATTEMPT",
  "tentative échouée": "FAILED_ATTEMPT",
  absent: "FAILED_ATTEMPT",
  "client absent": "FAILED_ATTEMPT",
  "no answer": "FAILED_ATTEMPT",
  refused: "FAILED_ATTEMPT",
  refusé: "FAILED_ATTEMPT",
  مرفوض: "FAILED_ATTEMPT",
  returning: "RETURNING",
  "return in progress": "RETURNING",
  "retour en cours": "RETURNING",
  returned: "RETURNED",
  retourné: "RETURNED",
  retour: "RETURNED",
  "تم الإرجاع": "RETURNED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
  annulé: "CANCELLED",
  ملغى: "CANCELLED",
  exception: "EXCEPTION",
  problem: "EXCEPTION",
  incident: "EXCEPTION",
  damaged: "EXCEPTION",
  lost: "EXCEPTION",
};

export type EventDecision = { apply: true } | { apply: false; reason: "TERMINAL" | "LATE" | "SAME_STATE" };

/** يقرر هل يُطبَّق حدث وارد (يعالج التأخر والتكرار والحالات النهائية). */
export function decideEvent(
  current: { status: string; lastEventAt: Date | null },
  event: { canonical: string; occurredAt: Date }
): EventDecision {
  if (isFinalStatus(current.status)) return { apply: false, reason: "TERMINAL" };
  if (current.lastEventAt && event.occurredAt.getTime() < current.lastEventAt.getTime()) return { apply: false, reason: "LATE" };
  if (event.canonical === current.status) return { apply: false, reason: "SAME_STATE" };
  return { apply: true };
}

/** معرّف حدث ثابت عندما لا ترسل الشركة معرّفاً (يمنع المعالجة المزدوجة). */
export function deriveEventId(p: { providerId: number; externalId?: string | null; rawStatus: string; occurredAt: Date }): string {
  return createHash("sha256")
    .update([p.providerId, p.externalId ?? "", normalizeExternalStatus(p.rawStatus), p.occurredAt.toISOString()].join("|"))
    .digest("hex");
}