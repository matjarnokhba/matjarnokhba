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
  LOGISTICS_TRANSFER_CREATE: "إنشاء نقل",
  LOGISTICS_TRANSFER_ADD_ITEMS: "إضافة عناصر لنقل",
  LOGISTICS_TRANSFER_REMOVE_ITEMS: "إزالة عناصر من نقل",
  LOGISTICS_TRANSFER_PREPARE: "تجهيز نقل",
  LOGISTICS_TRANSFER_APPROVE: "موافقة على نقل",
  LOGISTICS_TRANSFER_DISPATCH: "إرسال نقل",
  LOGISTICS_TRANSFER_RECEIVE: "استلام نقل",
  LOGISTICS_TRANSFER_RESOLVE_DISCREPANCY: "حسم فرق نقل",
  LOGISTICS_TRANSFER_CLOSE: "إغلاق نقل",
  LOGISTICS_TRANSFER_CANCEL: "إلغاء نقل",
  LOGISTICS_PLATFORM_CREATE: "إنشاء منصة عميلة",
  LOGISTICS_PLATFORM_UPDATE: "تعديل منصة",
  LOGISTICS_PLATFORM_SUSPEND: "تعليق منصة",
  LOGISTICS_PLATFORM_ACTIVATE: "تفعيل منصة",
  LOGISTICS_PLATFORM_REVOKE: "إلغاء منصة",
  LOGISTICS_PLATFORM_ROTATE_KEY: "تدوير مفتاح منصة",
  LOGISTICS_LINK_CREATE: "ربط شركة بمنصة",
  LOGISTICS_LINK_PAUSE: "إيقاف ربط",
  LOGISTICS_LINK_RESUME: "استئناف ربط",
  LOGISTICS_LINK_REVOKE: "إلغاء ربط",
  LOGISTICS_LINK_REINSTATE: "إعادة تفعيل ربط",
  LOGISTICS_COMPANY_BRAND_UPDATE: "تعديل هوية الشركة",
  LOGISTICS_COMPANY_EXTERNAL_ACCESS: "تغيير السماح بالمنصات الخارجية",
  LOGISTICS_DRIVER_ASSIGN_COMPANY: "إسناد سائق لشركة",
};

export function statusTone(s: string): Tone {
  if (s === "ACTIVE") return "green";
  if (s === "SUSPENDED" || s === "DETACHING") return "yellow";
  if (s === "CLOSED" || s === "DETACHED" || s === "REVOKED") return "red";
  return "gray";
}