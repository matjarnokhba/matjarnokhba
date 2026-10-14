import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q")?.trim() || "";
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "100"),
      200
    );

    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { nameFr: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    const cities = await prisma.city.findMany({
      where,
      select: {
        id: true,
        name: true,
        nameFr: true,
        slug: true,
        region: true,
        postalCode: true,
        _count: {
          select: { districts: { where: { isActive: true } } },
        },
      },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      take: limit,
    });

    return NextResponse.json({
      success: true,
      cities: cities.map((c) => ({
        id: c.id,
        name: c.name,
        nameFr: c.nameFr,
        slug: c.slug,
        region: c.region,
        postalCode: c.postalCode,
        districtsCount: c._count.districts,
      })),
    });
  } catch (error) {
    console.error("Cities list error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}