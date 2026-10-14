import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cityId = parseInt(id);
    if (isNaN(cityId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q")?.trim() || "";

    const where: any = {
      cityId,
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { nameFr: { contains: search, mode: "insensitive" } },
      ];
    }

    const districts = await prisma.district.findMany({
      where,
      select: {
        id: true,
        name: true,
        nameFr: true,
        type: true,
      },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      take: 300,
    });

    return NextResponse.json({ success: true, districts });
  } catch (error) {
    console.error("Districts list error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}