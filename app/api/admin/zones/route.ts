import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (
    current.user.role !== "ADMIN" &&
    current.user.role !== "SUPER_ADMIN"
  ) {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

const createSchema = z.object({
  code: z.string().trim().min(2).max(30).toUpperCase(),
  name: z.string().trim().min(2).max(100),
  type: z.enum(["COLLECTION", "DELIVERY"]),
  city: z.string().trim().min(2).max(100),
  districts: z.array(z.string().trim().min(1).max(100)).default([]),
  description: z.string().trim().max(500).optional().nullable(),
  order: z.number().int().min(0).default(0),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "ALL";
    const city = searchParams.get("city") || "ALL";
    const search = searchParams.get("q")?.trim().toLowerCase() || "";

    const where: any = {};
    if (type !== "ALL") where.type = type;
    if (city !== "ALL") where.city = city;

    const zones = await prisma.zone.findMany({
      where,
      include: {
        _count: {
          select: {
            sellers: true,
            collectors: true,
            deliveryPersons: true,
            shipments: true,
          },
        },
      },
      orderBy: [{ type: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    });

    let filtered = zones;
    if (search) {
      filtered = zones.filter(
        (z) =>
          z.code.toLowerCase().includes(search) ||
          z.name.toLowerCase().includes(search) ||
          z.city.toLowerCase().includes(search)
      );
    }

    // Cities
    const cityRows = await prisma.zone.findMany({
      where: { isActive: true },
      select: { city: true },
      distinct: ["city"],
    });
    const cities = cityRows.map((r) => r.city);

    return NextResponse.json({
      success: true,
      zones: filtered,
      cities,
    });
  } catch (error) {
    console.error("Zones list error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check code unique
    const existing = await prisma.zone.findUnique({
      where: { code: data.code },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "الرمز مستخدم بالفعل" },
        { status: 409 }
      );
    }

    const zone = await prisma.zone.create({
      data: {
        code: data.code,
        name: data.name,
        type: data.type,
        city: data.city,
        districts: data.districts,
        description: data.description || null,
        order: data.order,
      },
    });

    return NextResponse.json({ success: true, zone }, { status: 201 });
  } catch (error) {
    console.error("Zone create error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}