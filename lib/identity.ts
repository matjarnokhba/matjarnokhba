// توحيد الهاتف والإيميل لبناء هوية واحدة لكل إنسان

const ARABIC_INDIC = /[\u0660-\u0669]/g;
const EXT_ARABIC_INDIC = /[\u06F0-\u06F9]/g;

// يعيد +212XXXXXXXXX أو null إن لم يكن رقماً مغربياً صالحاً
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let d = raw
    .replace(/[\s().\-]/g, "")
    .replace(ARABIC_INDIC, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(EXT_ARABIC_INDIC, (c) => String(c.charCodeAt(0) - 0x06f0));
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  if (!/^\d+$/.test(d)) return null;
  if (d.startsWith("212")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1); // +212 0661... (صفر زائد)
  if (!/^[5-7]\d{8}$/.test(d)) return null;
  return "+212" + d;
}

// حروف صغيرة؛ في Gmail نحذف النقاط وما بعد +
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return null;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  if (!domain) return null;
  if (domain === "googlemail.com") domain = "gmail.com";
  local = local.split("+")[0];
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return local ? `${local}@${domain}` : null;
}