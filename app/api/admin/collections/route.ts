import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { PermissionService, PERMISSIONS } from "@/services/permission.service";
import { CollectionService } from "@/services/collection.service";

const createSchema = z.object({
  deliveryPersonId: z.number().int().positive(),
  fulfillmentItemIds: z.array(z.number().int().positive()).min(1),
  scheduledAt: z.string().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

// ═══ GET ═══
export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    const canView = await PermissionService.hasPermission(
      current.user.id,
      PERMISSIONS.VIEW_COLLECTIONS
    );
    if (!canView) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "ALL";

    const where: any = {};
    if (status !== "ALL") where.status = status;

    const assignments = await prisma.collectionAssignment.findMany({
      where,
      include: {
        deliveryPerson: {
          include: { user: { select: { name: true, phone: true } } },
        },
        items: {
          include: {
            fulfillmentItem: {
              include: {
                seller: { select: { storeName: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const formatted = assignments.map((a) => ({
      id: a.id,
      assignmentNumber: a.assignmentNumber,
      status: a.status,
      scheduledAt: a.scheduledAt,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      createdAt: a.createdAt,
      deliveryPerson: {
        name: a.deliveryPerson.user.name,
        phone: a.deliveryPerson.user.phone,
      },
      itemsCount: a.items.length,
      collectedCount: a.items.filter((i) => i.collectedAt).length,
      sellers: [...new Set(a.items.map((i) => i.fulfillmentItem.seller.storeName))],
    }));

    return NextResponse.json({ success: true, assignments: formatted });
  } catch (error) {
    console.error("Collections GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══ POST ═══
export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    const canCreate = await PermissionService.hasPermission(
      current.user.id,
      PERMISSIONS.ASSIGN_COLLECTION
    );
    if (!canCreate) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
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

    const assignment = await CollectionService.create({
      deliveryPersonId: data.deliveryPersonId,
      createdById: current.user.id,
      fulfillmentItemIds: data.fulfillmentItemIds,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      notes: data.notes || null,
    });

    return NextResponse.json(
      {
        success: true,
        assignment: {
          id: assignment.id,
          assignmentNumber: assignment.assignmentNumber,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Collections POST error:", error);
    const message =
      error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}