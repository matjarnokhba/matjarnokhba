import { Redis } from "@upstash/redis";

// ═══════════════════════════════════════════
// Rate Limiter — Vercel KV (Redis) + In-memory Fallback (dev only)
// ═══════════════════════════════════════════

const hasKV = !!(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

const isProd = process.env.NODE_ENV === "production";

if (isProd && !hasKV) {
  console.error(
    "[CRITICAL] Rate limiting KV is not configured in production. " +
      "In-memory fallback is DISABLED in production because it provides " +
      "NO protection across serverless instances. All rate-limited endpoints " +
      "will FAIL CLOSED until KV_REST_API_URL and KV_REST_API_TOKEN are set."
  );
}

const redis: Redis | null = hasKV
  ? new Redis({
      url: process.env.KV_REST_API_URL as string,
      token: process.env.KV_REST_API_TOKEN as string,
    })
  : null;

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
};

// ═══ In-memory fallback (dev only) ═══
type Entry = { count: number; resetAt: number };
const memoryStore = new Map<string, Entry>();

if (!redis && !isProd && typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetAt < now) memoryStore.delete(key);
    }
  }, 5 * 60 * 1000);
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();

  // ═══ Production without KV → fail closed ═══
  if (!redis && isProd) {
    return {
      success: false,
      remaining: 0,
      resetAt: now + windowMs,
      retryAfterMs: windowMs,
    };
  }

  // ═══ Redis (Production) ═══
  if (redis) {
    const redisKey = `rl:${key}`;
    const windowSec = Math.ceil(windowMs / 1000);

    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSec);
    }

    const ttl = await redis.ttl(redisKey);
    const resetAt = now + (ttl > 0 ? ttl * 1000 : windowMs);

    if (count > limit) {
      return {
        success: false,
        remaining: 0,
        resetAt,
        retryAfterMs: Math.max(0, resetAt - now),
      };
    }

    return {
      success: true,
      remaining: Math.max(0, limit - count),
      resetAt,
      retryAfterMs: 0,
    };
  }

  // ═══ In-memory (dev only) ═══
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return {
      success: true,
      remaining: limit - 1,
      resetAt,
      retryAfterMs: 0,
    };
  }

  if (entry.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterMs: entry.resetAt - now,
    };
  }

  entry.count++;
  return {
    success: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
    retryAfterMs: 0,
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  if (redis) {
    await redis.del(`rl:${key}`);
    return;
  }
  if (isProd) return;
  memoryStore.delete(key);
}

export function getClientIp(request: Request): string {
  const headers = request.headers;

  // 1. Vercel-controlled header — cannot be spoofed by client
  const vercelForwarded = headers.get("x-vercel-forwarded-for");
  if (vercelForwarded) {
    const first = vercelForwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  // 2. Vercel sets this reliably
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    if (trimmed) return trimmed;
  }

  // 3. Last resort: rightmost entry (appended by closest trusted proxy)
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return "unknown";
}

export function formatRetryAfter(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} ثانية`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} دقيقة`;
}