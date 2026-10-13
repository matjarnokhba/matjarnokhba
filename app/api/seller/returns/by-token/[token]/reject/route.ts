import { NextResponse } from "next/server";
import { z } from "zod";
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

const schema = z.object({
  reason: z.string().trim().min(5, "السبب مطلوب (5 أحرف)").max(500),
});

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

    const belongsToSeller = shipment.returnRequest.items.some(
      (ri: any) => ri.orderItem.seller?.id === auth.seller.id
    );

    if (!belongsToSeller) {
      return NextResponse.json(
        { success: false, message: "هذا المرتجع ليس لمتجرك" },
        { status: 403 }
      );
    }

    if (shipment.status !== "IN_TRANSIT_TO_SELLER") {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن الرفض — الحالة: ${shipment.status}`,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.returnShipment.update({
        where: { id: shipment.id },
        data: {
          status: "DELIVERED_TO_SELLER",
          deliveredToSellerAt: new Date(),
          sellerRejectionReason: parsed.data.reason,
        },
      });

      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "STATUS_CHANGE",
        entity: "ReturnShipment",
        entityId: String(shipment.id),
        newData: {
          returnNumber: shipment.returnNumber,
          action: "seller_rejected",
          reason: parsed.data.reason,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });

      // إشعار الأدمن
      const admins = await tx.user.findMany({
        where: {
          role: { in: ["ADMIN", "SUPER_ADMIN"] },
          deletedAt: null,
        },
        select: { id: true },
      });
      for (const a of admins) {
        await tx.notification.create({
          data: {
            userId: a.id,
            type: "RETURN_REJECTED",
            title: "❌ التاجر رفض المرتجع",
            message: `المرتجع ${shipment.returnNumber} — السبب: ${parsed.data.reason}`,
            link: `/admin/returns/${shipment.returnId}`,
            category: "ORDER",
            severity: "WARNING",
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      returnNumber: shipment.returnNumber,
    });
  } catch (error) {
    console.error("Seller reject error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}