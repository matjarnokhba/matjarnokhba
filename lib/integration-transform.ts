import type { ExternalShipmentPayload } from "@/lib/courier-adapter";

type Snap = Record<string, unknown> | null | undefined;
export type TransformOrder = { orderNumber: string; address: Snap; customer: Snap };

export class TransformError extends Error {}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

export function normalizePhone(p: string): string {
  let d = p.replace(/[\s().-]/g, "");
  if (d.startsWith("+212")) d = "0" + d.slice(4);
  else if (d.startsWith("00212")) d = "0" + d.slice(5);
  else if (d.startsWith("212") && d.length === 12) d = "0" + d.slice(3);
  return d;
}

/** يحوّل شحنتنا إلى البنية الموحدة (يحفظ أرقام الطلبات الأصلية). */
export function buildShipmentPayload(input: { shipmentNumber: string; totalCOD: number; orders: TransformOrder[]; isTest?: boolean }): ExternalShipmentPayload {
  if (input.orders.length === 0) throw new TransformError("الشحنة بلا طلبات");
  const recips = input.orders.map((o) => {
    const a = (o.address ?? {}) as Record<string, unknown>;
    const c = (o.customer ?? {}) as Record<string, unknown>;
    return {
      name: str(a.fullName) || str(c.name),
      phone: normalizePhone(str(a.phone)),
      city: str(a.city),
      district: str(a.district) || null,
      address: [str(a.street), str(a.buildingNumber)].filter(Boolean).join(" "),
    };
  });
  const first = recips[0];
  const missing: string[] = [];
  if (!first.name) missing.push("الاسم");
  if (!first.phone) missing.push("الهاتف");
  if (!first.city) missing.push("المدينة");
  if (!first.address) missing.push("العنوان");
  if (missing.length) throw new TransformError("بيانات ناقصة: " + missing.join("، "));
  if (!/^\+?\d{9,15}$/.test(first.phone)) throw new TransformError("رقم هاتف غير صالح");
  if (recips.some((r) => r.phone !== first.phone || r.city !== first.city)) throw new TransformError("طلبات بعناوين مختلفة في شحنة واحدة");
  const cod = Math.round(Number(input.totalCOD) * 100) / 100;
  if (!Number.isFinite(cod) || cod < 0) throw new TransformError("مبلغ الدفع عند الاستلام غير صالح");
  return {
    reference: input.shipmentNumber,
    isTest: input.isTest ?? false,
    cod,
    currency: "MAD",
    recipient: { name: first.name, phone: first.phone, city: first.city, district: first.district, address: first.address },
    parcels: 1,
    orderNumbers: input.orders.map((o) => o.orderNumber),
  };
}