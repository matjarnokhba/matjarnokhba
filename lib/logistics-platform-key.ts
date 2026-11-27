import { createHash, randomBytes, timingSafeEqual } from "crypto";

const KEY_RE = /^nkp_([0-9a-f]{8})_([A-Za-z0-9_-]{32})$/;

export function hashPlatformKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** المفتاح الخام يُعرض مرة واحدة فقط؛ يُخزَّن الـhash والبادئة فقط. */
export function generatePlatformKey() {
  const prefix = randomBytes(4).toString("hex");
  const secret = randomBytes(24).toString("base64url");
  const raw = "nkp_" + prefix + "_" + secret;
  return { raw, prefix, hash: hashPlatformKey(raw) };
}

export function parsePlatformKey(raw: string): { prefix: string } | null {
  const m = KEY_RE.exec((raw ?? "").trim());
  return m ? { prefix: m[1] } : null;
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length > 0 && ba.length === bb.length && timingSafeEqual(ba, bb);
}