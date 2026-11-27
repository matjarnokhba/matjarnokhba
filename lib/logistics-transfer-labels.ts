import type { Tone } from "@/lib/logistics-labels";

export const TRANSFER_STATUS_LABEL: Record<string, string> = {
  DRAFT: "مسودة",
  PENDING_APPROVAL: "بانتظار الموافقة",
  PREPARED: "مجهّز",
  DISPATCHED: "مُرسَل",
  RECEIVED: "مستلم",
  RECEIVED_WITH_DISCREPANCY: "مستلم مع فروقات",
  CLOSED: "مغلق",
  CANCELLED: "ملغى",
};

export const TRANSFER_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "gray",
  PENDING_APPROVAL: "yellow",
  PREPARED: "blue",
  DISPATCHED: "blue",
  RECEIVED: "green",
  RECEIVED_WITH_DISCREPANCY: "yellow",
  CLOSED: "gray",
  CANCELLED: "red",
};

export const OUTCOME_LABEL: Record<string, string> = {
  PENDING: "قيد الانتظار",
  RECEIVED: "مستلم",
  PARTIAL: "جزئي",
  DAMAGED: "تالف",
  MISSING: "مفقود",
};

export const DISCREPANCY_LABEL: Record<string, string> = {
  MISSING: "مفقود",
  DAMAGED: "تالف",
  QUANTITY_MISMATCH: "فرق كمية",
};

export const PLATFORM_STATUS_LABEL: Record<string, string> = { ACTIVE: "نشطة", SUSPENDED: "معلّقة", REVOKED: "ملغاة" };
export const PLATFORM_KIND_LABEL: Record<string, string> = { OWN: "منصتنا", EXTERNAL: "خارجية" };
export const LINK_STATUS_LABEL: Record<string, string> = { ACTIVE: "نشط", PAUSED: "موقوف", REVOKED: "ملغى" };

export function linkTone(s: string): Tone {
  if (s === "ACTIVE") return "green";
  if (s === "PAUSED") return "yellow";
  if (s === "REVOKED") return "red";
  return "gray";
}