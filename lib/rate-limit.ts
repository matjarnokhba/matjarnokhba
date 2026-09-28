// ═══════════════════════════════════════════
// Rate Limiter بسيط (in-memory)
// ⚠️ ملاحظة: لا يعمل بشكل مثالي مع Serverless (Vercel)
// سيُستبدل بـRedis / Vercel KV عند النشر
// ═══════════════════════════════════════════

type Entry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Entry>();

// تنظيف دوري (كل 5 دقائق)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
};

/**
 * التحقق من Rate Limit
 * @param key مفتاح فريد (مثلاً: `login:${ip}`)
 * @param limit عدد المحاولات المسموحة
 * @param windowMs النافذة الزمنية بالميلي ثانية
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  // لا يوجد entry → ننشئ
  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      success: true,
      remaining: limit - 1,
      resetAt,
      retryAfterMs: 0,
    };
  }

  // تجاوز الحد
  if (entry.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterMs: entry.resetAt - now,
    };
  }

  // زيادة العدّاد
  entry.count++;
  return {
    success: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
    retryAfterMs: 0,
  };
}

/**
 * استخراج IP من الطلب
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

/**
 * إعادة تعيين Rate Limit (يُستخدم عند النجاح)
 */
export function resetRateLimit(key: string) {
  store.delete(key);
}

/**
 * تنسيق الوقت المتبقي
 */
export function formatRetryAfter(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} ثانية`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} دقيقة`;
}