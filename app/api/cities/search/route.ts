import { NextResponse } from "next/server";
import { searchMoroccanCities } from "@/lib/moroccan-cities";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    const cities = searchMoroccanCities(q, limit);

    return NextResponse.json({
      success: true,
      cities: cities.map((c) => ({
        name: c.name,
        nameFr: c.nameFr,
        slug: c.slug,
        region: c.region,
      })),
    });
  } catch (error) {
    console.error("Local cities search error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}