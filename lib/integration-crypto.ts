import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";

// AES-256-GCM بمفتاح فرعي مشتق (HKDF) من SELLER_DATA_KEY؛ AAD يربط النص المشفّر بالسجل.
const VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function masterKey(): Buffer {
  const key = process.env.SELLER_DATA_KEY;
  if (!key) throw new Error("SELLER_DATA_KEY غير معرّف");
  if (/^[0-9a-f]{64}$/i.test(key)) return Buffer.from(key, "hex");
  if (key.length === 44) {
    const b = Buffer.from(key, "base64");
    if (b.length === 32) return b;
  }
  throw new Error("SELLER_DATA_KEY غير صالح");
}

function subKey(purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", masterKey(), Buffer.from("nokhba-integration-v1"), Buffer.from(purpose), 32));
}

export function sealJson(purpose: string, aad: string, value: unknown): Uint8Array<ArrayBuffer> {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", subKey(purpose), iv);
  cipher.setAAD(Buffer.from(aad));
  const enc = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const combined = Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), enc]);
  const ab = new ArrayBuffer(combined.length);
  const out = new Uint8Array(ab);
  out.set(combined);
  return out;
}

export function openJson<T>(purpose: string, aad: string, data: Uint8Array | Buffer): T {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buf.length < 1 + IV_LENGTH + TAG_LENGTH || buf[0] !== VERSION) throw new Error("بيانات مشفّرة غير صحيحة");
  const iv = buf.subarray(1, 1 + IV_LENGTH);
  const tag = buf.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const enc = buf.subarray(1 + IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", subKey(purpose), iv);
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8")) as T;
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString("base64url");
}
export function generateWebhookToken(): string {
  return randomBytes(18).toString("base64url");
}