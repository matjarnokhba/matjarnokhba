import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { searchPlaces } from "@/lib/geocoding";

// ═══ Simple in-memory rate limit (photon is free but public) ═══
const rateMap = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 40;

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
    // ═══ Auth required (avoid public abuse) ═══
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    // ═══ Rate limit ═══
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

    // Photon supports only: default, de, en, fr (NOT ar)
    const rawLang = searchParams.get("lang") || "fr";
    const lang = (["fr", "en", "default"].includes(rawLang)
      ? rawLang
      : "fr") as "fr" | "en" | "default";

    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const bbox = searchParams.get("bbox");
    const typesParam = searchParams.get("types");

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, results: [] });
    }

    const types = typesParam
      ? typesParam.split(",").filter(Boolean)
      : undefined;

    const results = await searchPlaces(q, {
      lang,
      limit,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      bbox: bbox || undefined,
      types,
      includeCountryCodes: ["MA"],
    });

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Geocoding search error:", error);
    return NextResponse.json(
      { success: false, message: "فشل البحث" },
      { status: 500 }
    );
  }
}