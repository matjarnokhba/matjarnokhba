import crypto from "crypto";

// ═══════════════════════════════════════════
// AES-256-GCM Encryption
// ═══════════════════════════════════════════

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const key = process.env.SELLER_DATA_KEY;

  if (!key) {
    throw new Error(
      "SELLER_DATA_KEY غير معرّف في .env — راجع الإعداد"
    );
  }

  // hex (64 chars)
  if (/^[0-9a-f]{64}$/i.test(key)) {
    const buf = Buffer.from(key, "hex");
    if (buf.length !== KEY_LENGTH) {
      throw new Error("SELLER_DATA_KEY بطول خاطئ");
    }
    return buf;
  }

  // base64 (44 chars)
  if (key.length === 44) {
    const buf = Buffer.from(key, "base64");
    if (buf.length !== KEY_LENGTH) {
      throw new Error("SELLER_DATA_KEY بطول خاطئ");
    }
    return buf;
  }

  throw new Error(
    "SELLER_DATA_KEY يجب أن يكون 32 bytes (hex 64 chars أو base64 44 chars)"
  );
}

// ═══════ التشفير — يُرجع Uint8Array<ArrayBuffer> لـPrisma ═══════
export function encrypt(plaintext: string): Uint8Array<ArrayBuffer> {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // [IV (12)][AuthTag (16)][Encrypted]
  const combined = Buffer.concat([iv, authTag, encrypted]);

  // ⚠️ ArrayBuffer صريح — يحل مشكلة TS 5.7
  const arrayBuffer = new ArrayBuffer(combined.length);
  const result = new Uint8Array(arrayBuffer);
  result.set(combined);
  return result;
}

// ═══════ فك التشفير ═══════
export function decrypt(data: Uint8Array | Buffer): string {
  const key = getKey();
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

  if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("بيانات مشفّرة غير صحيحة");
  }

  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

// ═══════ Hash للتحقق ═══════
export function hashForLookup(value: string): string {
  return crypto
    .createHash("sha256")
    .update(value.trim().replace(/\s/g, "").toUpperCase())
    .digest("hex");
}

// ═══════ Mask IBAN ═══════
export function maskIBAN(iban: string): string {
  const clean = iban.replace(/\s/g, "");
  if (clean.length < 8) return "****";
  return `${clean.slice(0, 2)}** **** **** ${clean.slice(-4)}`;
}

// ═══════ Mask Name ═══════
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

// ═══════ Mask RIB ═══════
export function maskRIB(rib: string): string {
  const clean = rib.replace(/\s/g, "");
  if (clean.length < 8) return "****";
  return `**** **** **** ${clean.slice(-4)}`;
}