import type { Tone } from "@/lib/logistics-labels";

export const PROVIDER_STATUS_LABEL: Record<string, string> = { DRAFT: "مسودة", TESTING: "قيد الاختبار", ACTIVE: "نشط", DISABLED: "معطّل" };
export function providerTone(s: string): Tone {
  return s === "ACTIVE" ? "green" : s === "TESTING" ? "yellow" : s === "DISABLED" ? "red" : "gray";
}

export const INTEGRATION_TYPE_LABEL: Record<string, string> = { API: "API", CSV: "CSV/Excel", MANUAL: "يدوي" };

export const AUTH_LABEL: Record<string, string> = {
  NONE: "بدون مصادقة",
  BEARER: "Bearer Token",
  API_KEY_HEADER: "مفتاح في ترويسة",
  BASIC: "اسم مستخدم وكلمة مرور",
  QUERY_KEY: "مفتاح في الرابط",
};

export const SUBMIT_STATE_LABEL: Record<string, string> = {
  NOT_SUBMITTED: "لم تُرسل",
  SUBMITTING: "قيد الإرسال",
  SUBMITTED: "مُرسلة",
  FAILED: "فشل الإرسال",
  MANUAL: "ربط يدوي",
};
export function submitTone(s: string): Tone {
  return s === "SUBMITTED" ? "green" : s === "MANUAL" ? "blue" : s === "FAILED" ? "red" : s === "SUBMITTING" ? "yellow" : "gray";
}

export const CANONICAL_UI_LABEL: Record<string, string> = {
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
export function canonicalTone(s: string): Tone {
  if (s === "DELIVERED") return "green";
  if (s === "FAILED_ATTEMPT" || s === "EXCEPTION") return "red";
  if (s === "RETURNING" || s === "RETURNED" || s === "CANCELLED") return "yellow";
  if (s === "PENDING_DISPATCH") return "gray";
  return "blue";
}

export const CAPABILITY_OPTIONS: { key: string; label: string }[] = [
  { key: "CREATE_SHIPMENT", label: "إنشاء الشحنات عبر API" },
  { key: "GET_SHIPMENT", label: "استرجاع بيانات الشحنة" },
  { key: "WEBHOOKS", label: "Webhooks لتحديث الحالات" },
  { key: "TRACKING_API", label: "تتبع عبر API" },
  { key: "CITY_MAPPING", label: "ربط المدن والمناطق" },
  { key: "RATES", label: "ربط الأسعار" },
  { key: "PICKUP_REQUESTS", label: "طلبات جمع الطرود" },
  { key: "COD", label: "الدفع عند الاستلام" },
  { key: "SETTLEMENTS", label: "التسويات المالية" },
  { key: "CSV_IMPORT", label: "استيراد CSV/Excel" },
  { key: "CSV_EXPORT", label: "تصدير CSV/Excel" },
  { key: "MANUAL_TRACKING", label: "ربط يدوي" },
];

export const DEFAULT_CAPS: Record<string, string[]> = {
  MANUAL: ["MANUAL_TRACKING"],
  API: ["CREATE_SHIPMENT", "WEBHOOKS", "COD"],
  CSV: ["CSV_IMPORT", "CSV_EXPORT", "COD"],
};

export const IGNORED_REASON_LABEL: Record<string, string> = {
  TERMINAL: "بعد حالة نهائية",
  LATE: "حدث متأخر",
  SAME_STATE: "نفس الحالة",
  UNMAPPED: "حالة غير مربوطة",
  CONFLICT: "تعارض",
};

export const OPERATION_LABEL: Record<string, string> = {
  CREATE_SHIPMENT: "إرسال شحنة",
  TEST_CONNECTION: "اختبار اتصال",
  TEST_SHIPMENT: "اختبار شحنة",
  EVENT: "حدث وارد",
  WEBHOOK: "Webhook",
  WEBHOOK_REJECTED: "Webhook مرفوض",
  WEBHOOK_BAD_JSON: "Webhook غير صالح",
  POLL: "استعلام تتبع",
};

export const EXAMPLE_HTTP_CONFIG = JSON.stringify(
  {
    version: 1,
    timeoutMs: 10000,
    test: { method: "GET", path: "/ping" },
    create: {
      method: "POST",
      path: "/shipments",
      bodyTemplate: {
        reference: "{{reference}}",
        cod: "{{cod}}",
        customer: { name: "{{recipient.name}}", phone: "{{recipient.phone}}", city: "{{recipient.city}}", address: "{{recipient.address}}" },
        account: "{{cred.accountId}}",
      },
      idempotencyHeader: "Idempotency-Key",
      externalIdPath: "data.id",
      trackingPath: "data.tracking_number",
      testBodyExtra: { sandbox: true },
    },
    tracking: { method: "GET", path: "/shipments/{{externalId}}", statusPath: "data.status", timePath: "data.updated_at" },
    webhook: { signatureHeader: "x-signature", eventsPath: "events", externalIdPath: "shipment_id", statusPath: "status", timePath: "time" },
  },
  null,
  2
);