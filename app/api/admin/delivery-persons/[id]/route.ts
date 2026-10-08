import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().min(8).max(20).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  vehicleType: z.string().trim().max(50).optional().nullable(),
  status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

// ═══════ GET — تفاصيل سائق ═══════
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
    const personId = parseInt(id);

    const person = await prisma.deliveryPerson.findUnique({
      where: { id: personId },
      include: {
        user: {
          select: { id: true, name: true, email: true, createdAt: true },
        },
        assignedOrders: {
          orderBy: { assignedAt: "desc" },
          take: 20,
          include: {
            items: { take: 3 },
          },
        },
      },
    });

    if (!person || person.deletedAt) {
      return NextResponse.json(
        { success: false, message: "السائق غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      person: {
        id: person.id,
        userId: person.user.id,
        name: person.user.name,
        email: person.user.email,
        phone: person.phone,
        city: person.city,
        vehicleType: person.vehicleType,
        status: person.status,
        notes: person.notes,
        totalDeliveries: person.totalDeliveries,
        successfulDeliveries: person.successfulDeliveries,
        failedDeliveries: person.failedDeliveries,
        returnCount: person.returnCount,
        joinedAt: person.user.createdAt,
        orders: person.assignedOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          total: Number(o.total),
          assignedAt: o.assignedAt,
          itemsCount: o.items.length,
        })),
      },
    });
  } catch (error) {
    console.error("Delivery person GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ PATCH — تحديث سائق ═══════
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
    const personId = parseInt(id);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const person = await prisma.deliveryPerson.findUnique({
      where: { id: personId },
      include: { user: true },
    });

    if (!person || person.deletedAt) {
      return NextResponse.json(
        { success: false, message: "السائق غير موجود" },
        { status: 404 }
      );
    }

    const data = parsed.data;

    await prisma.$transaction(async (tx) => {
      // تحديث User
      if (data.name !== undefined) {
        await tx.user.update({
          where: { id: person.userId },
          data: { name: data.name },
        });
      }

      // تحديث DeliveryPerson
      await tx.deliveryPerson.update({
        where: { id: personId },
        data: {
          ...(data.phone && { phone: data.phone }),
          ...(data.city && { city: data.city }),
          ...(data.vehicleType !== undefined && {
            vehicleType: data.vehicleType || null,
          }),
          ...(data.status && { status: data.status }),
          ...(data.notes !== undefined && { notes: data.notes || null }),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delivery person PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ DELETE — حذف (Soft) ═══════
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
    const personId = parseInt(id);

    // تحقق: لا يوجد طلبات نشطة
    const activeOrders = await prisma.order.count({
      where: {
        deliveryPersonId: personId,
        status: { in: ["PROCESSING", "SHIPPED"] },
      },
    });

    if (activeOrders > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن الحذف — يوجد ${activeOrders} طلب نشط مُسند للسائق`,
        },
        { status: 400 }
      );
    }

    // Soft delete
    await prisma.$transaction(async (tx) => {
      await tx.deliveryPerson.update({
        where: { id: personId },
        data: {
          deletedAt: new Date(),
          status: "INACTIVE",
        },
      });

      const person = await tx.deliveryPerson.findUnique({
        where: { id: personId },
      });

      if (person) {
        await tx.user.update({
          where: { id: person.userId },
          data: { deletedAt: new Date() },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delivery person DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}