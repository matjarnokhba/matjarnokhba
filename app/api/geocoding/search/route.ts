import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { searchPlaces, type GeocodingResult } from "@/lib/geocoding";

// ═══ Cache ═══
const cache = new Map<string, { data: GeocodingResult[]; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

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
  if (cache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (v.expiresAt < now) cache.delete(k);
    }
  }
}

// ═══ Rate limit ═══
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

function dedupe(list: GeocodingResult[]): GeocodingResult[] {
  const seen = new Set<string>();
  const out: GeocodingResult[] = [];
  for (const r of list) {
    if (seen.has(r.placeId)) continue;
    seen.add(r.placeId);
    out.push(r);
  }
  return out;
}

// ═══ توليد queries بديلة (للأخطاء الإملائية) ═══
function generateQueryVariants(q: string): string[] {
  const variants = new Set<string>();
  variants.add(q);

  // إزالة المسافات
  const noSpace = q.replace(/\s+/g, "");
  if (noSpace !== q) variants.add(noSpace);

  // إزالة حروف مكررة: "moumen" → "moumen" (لا تغيير)، "moumenne" → "moumene"
  const dedup = q.replace(/(.)\1+/g, "$1");
  if (dedup !== q) variants.add(dedup);

  // استبدال ou ↔ u (فرنسي ↔ عربي)
  if (q.includes("ou")) variants.add(q.replace(/ou/g, "u"));
  if (q.includes("u") && !q.includes("ou")) variants.add(q.replace(/u/g, "ou"));

  // استبدال ph ↔ f
  if (q.includes("ph")) variants.add(q.replace(/ph/g, "f"));
  if (q.includes("f")) variants.add(q.replace(/f/g, "ph"));

  // إزالة ال التعريف
  if (q.startsWith("ال")) variants.add(q.slice(2));

  return Array.from(variants).slice(0, 4);
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
    const q = searchParams.get("q")?.trim() || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const typesParam = searchParams.get("types");

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, results: [] });
    }

    const cacheKey = `${q.toLowerCase()}|${limit}|${lat || ""}|${lng || ""}|${typesParam || ""}`;

    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(
        { success: true, results: cached, cached: true },
        { headers: { "Cache-Control": "private, max-age=600" } }
      );
    }

    const types = typesParam
      ? typesParam.split(",").filter(Boolean)
      : undefined;

    const baseOpts = {
      limit,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      types,
      includeCountryCodes: ["ma"],
    };

    // ═══ 1. query الأصلي (ar + fr بالتوازي) ═══
    const [ar1, fr1] = await Promise.all([
      searchPlaces(q, { ...baseOpts, lang: "ar" }),
      searchPlaces(q, { ...baseOpts, lang: "fr" }),
    ]);

    let merged = dedupe([...ar1, ...fr1]);

    // ═══ 2. إذا نتائج قليلة → جرّب variants ═══
    if (merged.length < 3) {
      const variants = generateQueryVariants(q).slice(1);

      for (const v of variants) {
        const [ar2, fr2] = await Promise.all([
          searchPlaces(v, { ...baseOpts, lang: "ar", limit: 5 }),
          searchPlaces(v, { ...baseOpts, lang: "fr", limit: 5 }),
        ]);
        merged = dedupe([...merged, ...ar2, ...fr2]);

        if (merged.length >= limit) break;
      }
    }

    const results = merged.slice(0, limit);

    setCached(cacheKey, results);

    return NextResponse.json(
      { success: true, results },
      { headers: { "Cache-Control": "private, max-age=600" } }
    );
  } catch (error) {
    console.error("Geocoding search error:", error);
    return NextResponse.json(
      { success: false, message: "فشل البحث" },
      { status: 500 }
    );
  }
}