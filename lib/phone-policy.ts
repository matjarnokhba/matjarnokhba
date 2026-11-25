import { normalizePhone } from "./identity";

export type PhoneDecision =
  | { action: "keep" }
  | { action: "set"; phone: string }
  | { action: "reject"; message: string };

// الهاتف هو هوية الإنسان: بعد تسجيله لا يُغيَّر ولا يُحذف من الملف الشخصي (حتى نضيف OTP).
export function decidePhoneUpdate(i: { current: string | null | undefined; submitted: string }): PhoneDecision {
  const submitted = (i.submitted ?? "").trim();
  if (i.current) {
    if (!submitted) return { action: "keep" };
    const n = normalizePhone(submitted);
    const cur = normalizePhone(i.current) ?? i.current;
    if (n && n === cur) return { action: "keep" };
    return { action: "reject", message: "لا يمكن تغيير رقم الهاتف بعد تسجيله. تواصل مع الدعم." };
  }
  if (!submitted) return { action: "keep" };
  const n = normalizePhone(submitted);
  if (!n) return { action: "reject", message: "رقم الهاتف غير صالح (مثال: 0612345678)" };
  return { action: "set", phone: n };
}