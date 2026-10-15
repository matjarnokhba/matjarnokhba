import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import {
  reverseGeocode,
  isWithinMorocco,
  type GeocodingResult,
} from "@/lib/geocoding";

// Cache for reverse (fewer queries, longer TTL)
const cache = new Map<string, { data: GeocodingResult | null; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCached(key: string) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function setCached(key: string, data: GeocodingResult | null) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Nominatim rate limit: 1 req/sec
const rateMap = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 55;

function checkRate(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_PER_WINDOW) return false;
  entry.count++;
  return true;
}

export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!checkRate(ip)) {
      return NextResponse.json(
        { success: false, message: "محاولات كثيرة" },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, message: "إحداثيات غير صحيحة" },
        { status: 400 }
      );
    }

    if (!isWithinMorocco(lat, lng)) {
      return NextResponse.json(
        { success: false, message: "الموقع خارج المغرب" },
        { status: 400 }
      );
    }

    const cacheKey = `${lat.toFixed(5)}|${lng.toFixed(5)}`;
    const cached = getCached(cacheKey);
    if (cached !== undefined) {
      return NextResponse.json({
        success: true,
        result: cached,
        cached: true,
      });
    }

    const result = await reverseGeocode(lat, lng, "ar");
    setCached(cacheKey, result);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return NextResponse.json(
      { success: false, message: "فشل تحديد الموقع" },
      { status: 500 }
    );
  }
}