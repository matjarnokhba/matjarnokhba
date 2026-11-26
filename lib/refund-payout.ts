import { isUploadThingUrl } from "@/lib/upload-url";

export const PAYOUT_METHODS = ["BANK", "CASH_PLUS", "WAFACASH"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export type PayoutInput = {
  holderName?: string;
  bankName?: string;
  rib?: string;
  fullName?: string;
  cinImageUrl?: string;
};

export type PayoutDetails = {
  method: PayoutMethod;
  holderName: string;
  bankName?: string;
  rib?: string;
  cinImageUrl?: string;
};

export function isPayoutMethod(m: string): m is PayoutMethod {
  return (PAYOUT_METHODS as readonly string[]).includes(m);
}

export function normalizeRib(raw: string): string {
  return raw
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\s\-.]/g, "");
}

export function isValidRib(raw: string): boolean {
  return /^\d{24}$/.test(normalizeRib(raw));
}

export function maskRib(rib: string): string {
  const r = normalizeRib(rib);
  if (r.length <= 7) return "****";
  return r.slice(0, 3) + "*".repeat(r.length - 7) + r.slice(-4);
}

export function maskName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p.slice(0, 1) + "***")
    .join(" ");
}

// يتحقق من بيانات الاسترداد حسب الطريقة المختارة فقط ويتجاهل أي حقول أخرى
export function validatePayoutDetails(
  method: string,
  input?: PayoutInput | null
): PayoutDetails | null {
  if (!isPayoutMethod(method)) return null;
  const p = input ?? {};

  if (method === "BANK") {
    const holderName = (p.holderName ?? "").trim();
    const bankName = (p.bankName ?? "").trim();
    if (holderName.length < 3 || holderName.length > 100) {
      throw new Error("أدخل الاسم الكامل لصاحب الحساب البنكي");
    }
    if (bankName.length < 2 || bankName.length > 60) {
      throw new Error("أدخل اسم البنك");
    }
    if (!isValidRib(p.rib ?? "")) {
      throw new Error("رقم RIB غير صحيح (يجب أن يتكون من 24 رقماً)");
    }
    return { method, holderName, bankName, rib: normalizeRib(p.rib ?? "") };
  }

  const fullName = (p.fullName ?? "").trim();
  if (fullName.length < 3 || fullName.length > 100) {
    throw new Error("أدخل الاسم الكامل كما في بطاقتك الوطنية");
  }
  const cin = (p.cinImageUrl ?? "").trim();
  if (cin && !isUploadThingUrl(cin)) {
    throw new Error("رابط صورة البطاقة غير صالح");
  }
  return { method, holderName: fullName, cinImageUrl: cin || undefined };
}