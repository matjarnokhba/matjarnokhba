import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { ReturnShipmentService } from "@/services/return-shipment.service";
import { AuditService } from "@/services/audit.service";

async function requireSeller() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) {
    return { error: "ليس لديك متجر", status: 403 };
  }
  return { user: current.user, seller: current.user.seller };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const auth = await requireSeller();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { token } = await params;
    const shipment = await ReturnShipmentService.findByDeliveryToken(token);

    if (!shipment) {
      return NextResponse.json(
        { success: false, message: "رمز غير صحيح" },
        { status: 404 }
      );
    }

    // ═══ تحقق: التاجر صاحب المنتج؟ ═══
    const belongsToSeller = shipment.returnRequest.items.some(
      (ri: any) => ri.orderItem.seller?.id === auth.seller.id
    );

    if (!belongsToSeller) {
      return NextResponse.json(
        { success: false, message: "هذا المرتجع ليس لمتجرك" },
        { status: 403 }
      );
    }

    // ═══ Idempotent ═══
    if (shipment.status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        alreadyConfirmed: true,
        returnNumber: shipment.returnNumber,
      });
    }

    if (shipment.status !== "IN_TRANSIT_TO_SELLER") {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن التأكيد — الحالة: ${shipment.status}`,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.returnShipment.update({
        where: { id: shipment.id },
        data: {
          status: "COMPLETED",
          deliveredToSellerAt: now,
          sellerConfirmedAt: now,
          sellerConfirmedById: auth.user.id,
          deliveryTokenRevokedAt: now,
          pickupTokenRevokedAt: now,
        },
      });

      // ═══ ReturnRequest → COMPLETED ═══
      await tx.returnRequest.update({
        where: { id: shipment.returnId },
        data: { status: "COMPLETED" },
      });

      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "STATUS_CHANGE",
        entity: "ReturnShipment",
        entityId: String(shipment.id),
        newData: {
          returnNumber: shipment.returnNumber,
          action: "seller_confirmed",
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });

      await tx.notification.create({
        data: {
          userId: shipment.returnRequest.userId,
          type: "RETURN_APPROVED",
          title: "✅ تم إكمال الإرجاع",
          message: `التاجر استلم المرتجع ${shipment.returnNumber}. شكرًا لك.`,
          link: `/orders/${shipment.returnRequest.orderId}`,
          category: "ORDER",
          severity: "INFO",
        },
      });
    });

    return NextResponse.json({
      success: true,
      alreadyConfirmed: false,
      returnNumber: shipment.returnNumber,
    });
  } catch (error) {
    console.error("Seller confirm error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}