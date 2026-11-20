// M12 — SSRF Protection
// يُستخدم للتحقق من أن URL خارجي يشير إلى مضيف مسموح به فقط.
// الهدف: منع خادمنا من جلب URLs داخلية (169.254.169.254, localhost, 10.x.x.x, ...)

const ALLOWED_DOC_HOST_PATTERNS: (string | RegExp)[] = [
  "utfs.io",           // UploadThing legacy
  /\.ufs\.sh$/i,       // UploadThing v7: <appId>.ufs.sh
];

function matchesAllowedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  for (const pattern of ALLOWED_DOC_HOST_PATTERNS) {
    if (typeof pattern === "string") {
      if (lower === pattern) return true;
    } else {
      if (pattern.test(lower)) return true;
    }
  }
  return false;
}

/**
 * يتحقق أن URL:
 *   - صالح (URL syntax)
 *   - بروتوكوله https فقط
 *   - مضيفه ضمن قائمة بيضاء (UploadThing)
 *
 * @returns true إذا كان آمناً للجلب من الخادم
 */
export function isSafeDocumentUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return matchesAllowedHost(parsed.hostname);
}

/**
 * نسخة تشخيصية تعيد سبب الرفض — للاستخدام في السجلات فقط
 */
export function whyUnsafeDocumentUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return "invalid_url";
  }
  if (parsed.protocol !== "https:") return `wrong_protocol:${parsed.protocol}`;
  if (!matchesAllowedHost(parsed.hostname)) return `host_not_allowed:${parsed.hostname}`;
  return null;
}