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

const patchSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  districts: z.array(z.string().trim().min(1).max(100)).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const zoneId = parseInt(id);
    if (isNaN(zoneId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const zone = await prisma.zone.findUnique({
      where: { id: zoneId },
      include: {
        sellers: {
          select: {
            id: true,
            storeName: true,
            city: true,
            user: { select: { name: true, email: true } },
          },
        },
        collectors: {
          select: { id: true, name: true, email: true, phone: true },
        },
        deliveryPersons: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
          },
        },
      },
    });

    if (!zone) {
      return NextResponse.json(
        { success: false, message: "المنطقة غير موجودة" },
        { status: 404 }
      );
    }

    // ═══ Candidates (غير المُسندين) ═══
    let candidates: any = {};

    if (zone.type === "COLLECTION") {
      const [sellers, collectors] = await Promise.all([
        prisma.seller.findMany({
          where: {
            deletedAt: null,
            status: "ACTIVE",
            collectionZoneId: null,
          },
          select: {
            id: true,
            storeName: true,
            city: true,
            user: { select: { name: true, email: true } },
          },
          take: 200,
          orderBy: { storeName: "asc" },
        }),
        prisma.user.findMany({
          where: {
            role: "COLLECTOR",
            deletedAt: null,
            collectionZones: { none: { id: zoneId } },
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            _count: {
              select: {
                collectionBatches: {
                  where: { status: "IN_TRANSIT" },
                },
              },
            },
          },
          take: 200,
          orderBy: { name: "asc" },
        }),
      ]);
      candidates = { sellers, collectors };
    } else {
      const drivers = await prisma.deliveryPerson.findMany({
        where: {
          deletedAt: null,
          status: "ACTIVE",
          deliveryZones: { none: { id: zoneId } },
        },
        include: {
          user: { select: { name: true, email: true, phone: true } },
          _count: {
            select: {
              shipments: {
                where: {
                  status: {
                    in: ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"],
                  },
                },
              },
            },
          },
        },
        take: 200,
        orderBy: { createdAt: "asc" },
      });
      candidates = { drivers };
    }

    return NextResponse.json({ success: true, zone, candidates });
  } catch (error) {
    console.error("Zone detail error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const zoneId = parseInt(id);
    if (isNaN(zoneId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const updates: any = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.city !== undefined) updates.city = parsed.data.city;
    if (parsed.data.districts !== undefined)
      updates.districts = parsed.data.districts;
    if (parsed.data.description !== undefined)
      updates.description = parsed.data.description;
    if (parsed.data.isActive !== undefined)
      updates.isActive = parsed.data.isActive;
    if (parsed.data.order !== undefined) updates.order = parsed.data.order;

    const zone = await prisma.zone.update({
      where: { id: zoneId },
      data: updates,
    });

    return NextResponse.json({ success: true, zone });
  } catch (error) {
    console.error("Zone patch error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const zoneId = parseInt(id);
    if (isNaN(zoneId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    // Soft delete: set isActive = false
    await prisma.zone.update({
      where: { id: zoneId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Zone delete error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}