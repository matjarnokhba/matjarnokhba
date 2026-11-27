export const CAPABILITIES = [
  "CREATE_SHIPMENT",
  "GET_SHIPMENT",
  "WEBHOOKS",
  "TRACKING_API",
  "CITY_MAPPING",
  "RATES",
  "PICKUP_REQUESTS",
  "COD",
  "SETTLEMENTS",
  "CSV_IMPORT",
  "CSV_EXPORT",
  "MANUAL_TRACKING",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABEL: Record<string, string> = {
  CREATE_SHIPMENT: "إنشاء الشحنات عبر API",
  GET_SHIPMENT: "استرجاع بيانات الشحنة",
  WEBHOOKS: "Webhooks لتحديث الحالات",
  TRACKING_API: "تتبع عبر API",
  CITY_MAPPING: "ربط المدن والمناطق",
  RATES: "ربط الأسعار",
  PICKUP_REQUESTS: "طلبات جمع الطرود",
  COD: "الدفع عند الاستلام",
  SETTLEMENTS: "التسويات المالية",
  CSV_IMPORT: "استيراد CSV/Excel",
  CSV_EXPORT: "تصدير CSV/Excel",
  MANUAL_TRACKING: "ربط يدوي",
};

export type AdapterContext = {
  provider: {
    id: number;
    code: string | null;
    integrationType: string;
    baseUrl: string | null;
    authScheme: string;
    capabilities: string[];
    config: unknown;
  };
  credentials: Record<string, string>;
  idempotencyKey?: string;
};

export type AdapterResult<T = unknown> =
  | { ok: true; data: T; httpStatus?: number }
  | { ok: false; error: string; retryable: boolean; httpStatus?: number };

/** البنية الموحدة لبيانات الشحنة المرسلة لأي شركة (التحويل لصيغة الشركة داخل المحوّل). */
export type ExternalShipmentPayload = {
  reference: string;
  isTest: boolean;
  cod: number;
  currency: "MAD";
  recipient: { name: string; phone: string; city: string; district: string | null; address: string; lat?: number; lng?: number };
  parcels: number;
  notes?: string;
};

export type CreateShipmentData = { externalId: string | null; trackingNumber: string | null; manual?: boolean; raw?: unknown };

export interface CourierAdapter {
  readonly type: "MANUAL" | "CSV" | "API";
  testConnection(ctx: AdapterContext): Promise<AdapterResult>;
  createShipment(ctx: AdapterContext, payload: ExternalShipmentPayload): Promise<AdapterResult<CreateShipmentData>>;
}

export function buildTestPayload(): ExternalShipmentPayload {
  return {
    reference: "TEST-" + Date.now(),
    isTest: true,
    cod: 100,
    currency: "MAD",
    recipient: { name: "اختبار", phone: "0600000000", city: "الدار البيضاء", district: null, address: "عنوان اختبار" },
    parcels: 1,
    notes: "شحنة اختبار — لا تُنفَّذ",
  };
}

/** الربط اليدوي: لا اتصال خارجي؛ التتبع والحالات تُدخل يدوياً. */
export const ManualAdapter: CourierAdapter = {
  type: "MANUAL",
  async testConnection() {
    return { ok: true, data: { manual: true } };
  },
  async createShipment() {
    return { ok: true, data: { externalId: null, trackingNumber: null, manual: true } };
  },
};

/** أنواع الربط غير المفعّلة بعد (HTTP/CSV) ترفض بوضوح بدل أن تفشل بصمت. */
export function notImplementedAdapter(type: "CSV" | "API"): CourierAdapter {
  const fail = async (): Promise<AdapterResult<never>> => ({ ok: false, error: "محوّل هذا النوع غير مفعّل بعد", retryable: false });
  return { type, testConnection: fail, createShipment: fail };
}

export function getAdapter(integrationType: string): CourierAdapter {
  if (integrationType === "MANUAL") return ManualAdapter;
  if (integrationType === "CSV") return notImplementedAdapter("CSV");
  return notImplementedAdapter("API");
}