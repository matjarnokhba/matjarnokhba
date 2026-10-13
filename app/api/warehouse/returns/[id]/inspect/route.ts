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
  inspectionStatus: z.enum(["INTACT", "DAMAGED", "INCOMPLETE"]),
  inspectionNotes: z.string().trim().max(1000).optional().nullable(),
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

    const { inspectionStatus, inspectionNotes } = parsed.data;

    const shipment = await prisma.returnShipment.findUnique({
      where: { returnId },
      include: {
        returnRequest: {
          include: {
            order: { select: { orderNumber: true } },
            user: { select: { id: true } },
          },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, message: "شحنة الإرجاع غير موجودة" },
        { status: 404 }
      );
    }

    const allowedStatuses = [
      "IN_TRANSIT_TO_WAREHOUSE",
      "RECEIVED_AT_WAREHOUSE",
    ];

    if (!allowedStatuses.includes(shipment.status)) {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن الفحص — الحالة: ${shipment.status}`,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.returnShipment.update({
        where: { id: shipment.id },
        data: {
          status: "INSPECTED",
          warehouseReceivedAt: shipment.warehouseReceivedAt || now,
          warehouseReceivedById: shipment.warehouseReceivedById || auth.user.id,
          inspectedAt: now,
          inspectedById: auth.user.id,
          inspectionStatus,
          inspectionNotes: inspectionNotes || null,
        },
      });

      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "WAREHOUSE_VERIFY",
        entity: "ReturnShipment",
        entityId: String(shipment.id),
        newData: {
          returnNumber: shipment.returnNumber,
          inspectionStatus,
          inspectionNotes,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });

      // إشعار العميل
      await tx.notification.create({
        data: {
          userId: shipment.returnRequest.userId,
          type: "RETURN_APPROVED",
          title: "✅ تم فحص مرتجعك",
          message: `المرتجع ${shipment.returnNumber} — الحالة: ${inspectionLabel(inspectionStatus)}`,
          link: `/orders/${shipment.returnRequest.orderId}`,
          category: "ORDER",
          severity: inspectionStatus === "INTACT" ? "INFO" : "WARNING",
        },
      });

      // إشعار التاجر
      const item = await tx.returnItem.findFirst({
        where: { returnId },
        include: {
          orderItem: {
            include: {
              seller: { select: { userId: true, storeName: true } },
            },
          },
        },
      });

      if (item?.orderItem?.seller) {
        await tx.notification.create({
          data: {
            userId: item.orderItem.seller.userId,
            type: "RETURN_APPROVED",
            title: "↩️ مرتجع في الطريق إليك",
            message: `سيعاد إليك مرتجع من العميل (${shipment.returnNumber}) — ${inspectionLabel(inspectionStatus)}`,
            link: `/seller/returns`,
            category: "ORDER",
            severity: "INFO",
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      returnNumber: shipment.returnNumber,
      inspectionStatus,
    });
  } catch (error) {
    console.error("Return inspect error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

function inspectionLabel(status: string): string {
  return (
    {
      INTACT: "سليم",
      DAMAGED: "متضرر",
      INCOMPLETE: "ناقص",
    }[status] || status
  );
}