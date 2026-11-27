import { isIP } from "net";
import { lookup } from "dns/promises";

function v4Private(ip: string): boolean {
  const o = ip.split(".").map(Number);
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = o;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 192 && b === 0 && o[2] === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** true لأي عنوان داخلي/محجوز/غير صالح (يُعدّ غير آمن). */
export function isPrivateIp(ip: string): boolean {
  const s = ip.toLowerCase();
  const v = isIP(s);
  if (v === 4) return v4Private(s);
  if (v === 6) {
    if (s === "::" || s === "::1") return true;
    if (s.startsWith("::ffff:")) {
      const t = s.slice(7);
      return isIP(t) === 4 ? v4Private(t) : true;
    }
    if (s.startsWith("64:ff9b:")) return true;
    const first = s.split(":")[0];
    if (/^f[cd]/.test(first)) return true;
    if (/^fe[89ab]/.test(first)) return true;
    if (/^ff/.test(first)) return true;
    return false;
  }
  return true;
}

/** فحص نحوي: https فقط، بدون بيانات دخول، بدون IP مباشر أو أسماء داخلية، منفذ 443 فقط. */
export function isSafeUrlSyntax(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== "443") return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || isIP(h)) return false;
  if (h === "localhost" || /\.(localhost|local|internal|lan|home|corp|intranet)$/.test(h)) return false;
  if (!h.includes(".")) return false;
  return true;
}

/** فحص DNS وقت الاتصال: يرفض أي اسم يُحلّ إلى عنوان داخلي. */
export async function checkHost(host: string): Promise<"ok" | "private" | "dns"> {
  const h = host.replace(/^\[|\]$/g, "");
  if (isIP(h)) return isPrivateIp(h) ? "private" : "ok";
  try {
    const addrs = await lookup(h, { all: true });
    if (addrs.length === 0) return "dns";
    return addrs.some((a) => isPrivateIp(a.address)) ? "private" : "ok";
  } catch {
    return "dns";
  }
}