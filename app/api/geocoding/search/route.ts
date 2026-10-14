import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { searchPlaces, type GeocodingResult } from "@/lib/geocoding";

// ═══ In-memory cache (5 min TTL) ═══
const cache = new Map<string, { data: GeocodingResult[]; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(key: string): GeocodingResult[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: GeocodingResult[]) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });

  // ═══ Cleanup when cache grows ═══
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (v.expiresAt < now) cache.delete(k);
    }
  }
}

// ═══ Rate limit ═══
const rateMap = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 60;

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
        { success: false, message: "محاولات كثيرة — انتظر قليلاً" },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";

    const rawLang = searchParams.get("lang") || "fr";
    const lang = (["fr", "en", "default"].includes(rawLang)
      ? rawLang
      : "fr") as "fr" | "en" | "default";

    const limit = Math.min(parseInt(searchParams.get("limit") || "8"), 20);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const typesParam = searchParams.get("types");

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, results: [] });
    }

    // ═══ Cache key ═══
    const cacheKey = `${q.toLowerCase()}|${lang}|${limit}|${lat || ""}|${lng || ""}|${typesParam || ""}`;

    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(
        { success: true, results: cached, cached: true },
        {
          headers: {
            "Cache-Control": "private, max-age=300",
          },
        }
      );
    }

    const types = typesParam
      ? typesParam.split(",").filter(Boolean)
      : undefined;

    const results = await searchPlaces(q, {
      lang,
      limit,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      types,
      includeCountryCodes: ["MA"],
    });

    setCached(cacheKey, results);

    return NextResponse.json(
      { success: true, results },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      }
    );
  } catch (error) {
    console.error("Geocoding search error:", error);
    return NextResponse.json(
      { success: false, message: "فشل البحث" },
      { status: 500 }
    );
  }
}