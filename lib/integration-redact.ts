const SENSITIVE = /key|secret|token|authorization|password|credential|signature/i;

/** نسخة آمنة للتسجيل: تحجب قيم أي مفتاح حساس وتختصر الحجم. */
export function redactSecrets(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 6) return "[deep]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactSecrets(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? "***" : redactSecrets(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 2000) return value.slice(0, 2000) + "…";
  return value;
}

export function compactForLog(value: unknown): unknown {
  const r = redactSecrets(value);
  try {
    return JSON.stringify(r).length > 20000 ? { truncated: true } : r;
  } catch {
    return { unserializable: true };
  }
}