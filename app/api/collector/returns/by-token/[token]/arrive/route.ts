import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { ReturnShipmentService } from "@/services/return-shipment.service";
import { AuditService } from "@/services/audit.service";

async function requireCollector() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  const allowed = ["COLLECTOR", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const auth = await requireCollector();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { token } = await params;
    const shipment = await ReturnShipmentService.findByPickupToken(token);

    if (!shipment) {
      return NextResponse.json(
        { success: false, message: "رمز غير صحيح" },
        { status: 404 }
      );
    }

    if (shipment.status === "IN_TRANSIT_TO_WAREHOUSE") {
      return NextResponse.json({
        success: true,
        alreadyInTransit: true,
        returnNumber: shipment.returnNumber,
      });
    }

    if (shipment.status !== "PICKED_UP") {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن التسليم — الحالة: ${shipment.status}`,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.returnShipment.update({
        where: { id: shipment.id },
        data: { status: "IN_TRANSIT_TO_WAREHOUSE" },
      });

      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "COLLECTION_DEPART",
        entity: "ReturnShipment",
        entityId: String(shipment.id),
        newData: {
          returnNumber: shipment.returnNumber,
          action: "arrive_at_warehouse",
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });

      const wms = await tx.user.findMany({
        where: {
          role: { in: ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"] },
          deletedAt: null,
        },
        select: { id: true },
      });
      for (const wm of wms) {
        await tx.notification.create({
          data: {
            userId: wm.id,
            type: "RETURN_REQUESTED",
            title: "🚚 مرتجع وصل للمستودع",
            message: `المرتجع ${shipment.returnNumber} جاهز للاستلام`,
            link: `/warehouse/returns`,
            category: "ORDER",
            severity: "INFO",
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      alreadyInTransit: false,
      returnNumber: shipment.returnNumber,
    });
  } catch (error) {
    console.error("Return arrive error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}