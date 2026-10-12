import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { AuditService } from "@/services/audit.service";

async function requireWarehouse() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const allowed = ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }

  return { user: current.user };
}

const schema = z.object({
  deliveryPersonId: z.number().int().positive("اختر سائقًا"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireWarehouse();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const shipmentId = parseInt(id);
    if (isNaN(shipmentId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const { deliveryPersonId } = parsed.data;

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        shipmentNumber: true,
        status: true,
        customerId: true,
        totalCOD: true,
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, message: "الشحنة غير موجودة" },
        { status: 404 }
      );
    }

    if (shipment.status !== "READY") {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن الإسناد — الحالة: ${shipment.status}`,
        },
        { status: 400 }
      );
    }

    const person = await prisma.deliveryPerson.findUnique({
      where: { id: deliveryPersonId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!person || person.deletedAt || person.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "السائق غير نشط" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. تحديث Shipment
      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: "ASSIGNED",
          deliveryPersonId,
          assignedAt: new Date(),
          assignedById: auth.user.id,
        },
      });

      // 2. DeliveryAssignment
      await tx.deliveryAssignment.create({
        data: {
          shipmentId,
          deliveryPersonId,
          assignedById: auth.user.id,
          status: "ASSIGNED",
        },
      });

      // 3. إشعار السائق
      await tx.notification.create({
        data: {
          userId: person.user.id,
          type: "SHIPPING_UPDATED",
          title: "📦 شحنة جديدة",
          message: `تم إسنادك شحنة ${shipment.shipmentNumber}`,
          link: `/delivery/shipments/${shipment.id}`,
          category: "ORDER",
          severity: "INFO",
          metadata: {
            shipmentId: shipment.id,
            shipmentNumber: shipment.shipmentNumber,
          },
        },
      });

      // 4. Audit
      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "DELIVERY_ASSIGN",
        entity: "Shipment",
        entityId: String(shipmentId),
        newData: {
          shipmentNumber: shipment.shipmentNumber,
          deliveryPersonId,
          deliveryPersonName: person.user.name,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });
    });

    return NextResponse.json({
      success: true,
      shipmentNumber: shipment.shipmentNumber,
      driverName: person.user.name,
    });
  } catch (error) {
    console.error("Assign shipment error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}