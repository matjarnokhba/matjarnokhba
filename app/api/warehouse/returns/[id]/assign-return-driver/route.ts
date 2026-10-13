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
  deliveryPersonId: z.number().int().positive(),
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
    const returnId = parseInt(id);
    if (isNaN(returnId)) {
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

    const shipment = await prisma.returnShipment.findUnique({
      where: { returnId },
      select: {
        id: true,
        status: true,
        returnNumber: true,
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, message: "شحنة الإرجاع غير موجودة" },
        { status: 404 }
      );
    }

    if (shipment.status !== "INSPECTED") {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن الإسناد — الحالة: ${shipment.status}`,
        },
        { status: 400 }
      );
    }

    const driver = await prisma.deliveryPerson.findUnique({
      where: { id: deliveryPersonId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!driver || driver.deletedAt || driver.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "السائق غير نشط" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.returnShipment.update({
        where: { id: shipment.id },
        data: {
          status: "IN_TRANSIT_TO_SELLER",
          returnDriverId: deliveryPersonId,
          returnAssignedAt: new Date(),
          returnAssignedById: auth.user.id,
        },
      });

      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "DELIVERY_ASSIGN",
        entity: "ReturnShipment",
        entityId: String(shipment.id),
        newData: {
          returnNumber: shipment.returnNumber,
          deliveryPersonId,
          deliveryPersonName: driver.user.name,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });

      await tx.notification.create({
        data: {
          userId: driver.user.id,
          type: "SHIPPING_UPDATED",
          title: "↩️ مهمة إرجاع جديدة",
          message: `تم إسنادك لإرجاع ${shipment.returnNumber} إلى التاجر`,
          link: `/delivery/returns`,
          category: "ORDER",
          severity: "INFO",
        },
      });
    });

    return NextResponse.json({
      success: true,
      returnNumber: shipment.returnNumber,
      driverName: driver.user.name,
    });
  } catch (error) {
    console.error("Assign return driver error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}