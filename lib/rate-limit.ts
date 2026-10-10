import { Redis } from "@upstash/redis";

// ═══════════════════════════════════════════
// Rate Limiter — Vercel KV (Redis) + In-memory Fallback
// ═══════════════════════════════════════════

const hasKV = !!(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

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

// ═══ In-memory fallback (للتطوير المحلي) ═══
type Entry = { count: number; resetAt: number };
const memoryStore = new Map<string, Entry>();

if (!redis && typeof setInterval !== "undefined") {
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

  // ═══ In-memory (Development) ═══
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
  memoryStore.delete(key);
}

export function getClientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export function formatRetryAfter(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} ثانية`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} دقيقة`;
}