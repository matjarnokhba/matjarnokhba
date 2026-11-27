export type Tone = "green" | "yellow" | "red" | "gray" | "blue";

export const COMPANY_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "نشطة",
  SUSPENDED: "موقوفة",
  DETACHING: "قيد الفصل",
  DETACHED: "مفصولة",
};
export const WAREHOUSE_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "نشط",
  SUSPENDED: "موقوف",
  CLOSED: "مغلق",
};
export const KIND_LABEL: Record<string, string> = { INTERNAL: "داخلية", EXTERNAL: "خارجية" };
export const SCOPE_LABEL: Record<string, string> = { PLATFORM: "المنصة", COMPANY: "شركة", WAREHOUSE: "مستودع" };
export const MEMBERSHIP_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "نشطة",
  SUSPENDED: "موقوفة",
  REVOKED: "مسحوبة",
};
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  LOGISTICS_WAREHOUSE_CREATE: "إنشاء مستودع",
  LOGISTICS_WAREHOUSE_UPDATE: "تعديل مستودع",
  LOGISTICS_COMPANY_CREATE: "إنشاء شركة",
  LOGISTICS_COMPANY_UPDATE: "تعديل شركة",
  LOGISTICS_COMPANY_STATUS: "تغيير حالة شركة",
  LOGISTICS_MEMBERSHIP_APPOINT: "تعيين عضو",
  LOGISTICS_MEMBERSHIP_UPDATE: "تعديل عضوية",
  LOGISTICS_MEMBERSHIP_REVOKE: "سحب عضوية",
};

export function statusTone(s: string): Tone {
  if (s === "ACTIVE") return "green";
  if (s === "SUSPENDED" || s === "DETACHING") return "yellow";
  if (s === "CLOSED" || s === "DETACHED" || s === "REVOKED") return "red";
  return "gray";
}