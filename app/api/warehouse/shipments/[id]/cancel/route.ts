import { NextResponse } from "next/server";
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

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        items: {
          include: {
            fulfillmentItem: {
              select: { id: true, status: true },
            },
            order: { select: { userId: true } },
          },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, message: "الشحنة غير موجودة" },
        { status: 404 }
      );
    }

    // ═══ فقط قبل الإسناد ═══
    if (shipment.status !== "READY") {
      return NextResponse.json(
        {
          success: false,
          message:
            "لا يمكن إلغاء الشحنة بعد إسنادها لسائق. ألغِ الإسناد أولاً.",
        },
        { status: 400 }
      );
    }

    const validItems = shipment.items.filter(
      (si) => si.fulfillmentItem !== null
    );

    const nonAllocated = validItems.filter(
      (si) => si.fulfillmentItem!.status !== "ALLOCATED"
    );

    if (nonAllocated.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `${nonAllocated.length} عنصر غيّر حالته — لا يمكن الإلغاء`,
        },
        { status: 400 }
      );
    }

    const { AssemblyService } = await import("@/services/assembly.service");

    // ═══ جمع usersId المتأثرين ═══
    const affectedUserIds = new Set<number>();
    for (const si of shipment.items) {
      affectedUserIds.add(si.order.userId);
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      // ═══ 1. إرجاع FulfillmentItems إلى VERIFIED ═══
      for (const si of validItems) {
        await tx.fulfillmentItem.update({
          where: { id: si.fulfillmentItem!.id },
          data: { status: "VERIFIED" },
        });

        await tx.fulfillmentStatusHistory.create({
          data: {
            fulfillmentItemId: si.fulfillmentItem!.id,
            fromStatus: "ALLOCATED",
            toStatus: "VERIFIED",
            changedById: auth.user.id,
            note: `إلغاء الشحنة ${shipment.shipmentNumber}`,
          },
        });
      }

      // ═══ 2. حذف ShipmentItems ═══
      await tx.shipmentItem.deleteMany({
        where: { shipmentId },
      });

      // ═══ 3. تحديث الشحنة → CANCELLED + إبطال QR ═══
      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: "CANCELLED",
          qrTokenRevokedAt: now,
        },
      });

      // ═══ 4. إعادة بناء AssemblyFiles للعملاء المتأثرين ═══
      try {
        for (const userId of affectedUserIds) {
          await AssemblyService.rebuildForUser(tx, userId);
        }
      } catch (e) {
        console.error("Assembly rebuild failed on shipment cancel:", e);
      }

      // ═══ 5. Audit ═══
      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "SHIPMENT_UPDATE",
        entity: "Shipment",
        entityId: String(shipmentId),
        oldData: { status: "READY" },
        newData: {
          status: "CANCELLED",
          shipmentNumber: shipment.shipmentNumber,
          itemsRestored: validItems.length,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });
    });

    return NextResponse.json({
      success: true,
      shipmentNumber: shipment.shipmentNumber,
      itemsRestored: validItems.length,
    });
  } catch (error) {
    console.error("Cancel shipment error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}