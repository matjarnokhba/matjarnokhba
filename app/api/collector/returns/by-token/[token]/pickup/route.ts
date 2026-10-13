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

    // ═══ Idempotent ═══
    if (
      shipment.status === "PICKED_UP" ||
      shipment.status === "IN_TRANSIT_TO_WAREHOUSE"
    ) {
      return NextResponse.json({
        success: true,
        alreadyPicked: true,
        returnNumber: shipment.returnNumber,
        shipmentId: shipment.id,
      });
    }

    if (shipment.status !== "PENDING_PICKUP") {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن الاستلام — الحالة: ${shipment.status}`,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.returnShipment.update({
        where: { id: shipment.id },
        data: {
          status: "PICKED_UP",
          pickedUpAt: now,
        },
      });

      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "COLLECTION_PICKUP",
        entity: "ReturnShipment",
        entityId: String(shipment.id),
        newData: {
          returnNumber: shipment.returnNumber,
          action: "pickup_from_customer",
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });

      // إشعار العميل
      await tx.notification.create({
        data: {
          userId: shipment.returnRequest.userId,
          type: "RETURN_REQUESTED",
          title: "📦 تم استلام المرتجع",
          message: `مسؤول الجمع استلم منتجاتك المُرجعة (${shipment.returnNumber})`,
          link: `/orders/${shipment.returnRequest.orderId}`,
          category: "ORDER",
          severity: "INFO",
        },
      });

      // إشعار Warehouse Manager
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
            title: "↩️ مرتجع في الطريق",
            message: `المرتجع ${shipment.returnNumber} بانتظار الوصول للمستودع`,
            link: `/warehouse/returns`,
            category: "ORDER",
            severity: "INFO",
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      alreadyPicked: false,
      returnNumber: shipment.returnNumber,
      shipmentId: shipment.id,
    });
  } catch (error) {
    console.error("Return pickup error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}