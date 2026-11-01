import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { orderActionSchema } from "@/lib/wholesale-order-validation";
import { WholesaleOrderService } from "@/services/wholesale-order.service";
import { checkBusinessAccess } from "@/lib/business-access";

const ACTION_TO_SIDE: Record<string, "buyer" | "seller"> = {
  accept: "seller",
  reject: "seller",
  prepare: "seller",
  ship: "seller",
  deliver: "buyer",
  complete: "buyer",
  cancel: "buyer",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const { id, orderId } = await params;
    const businessId = parseInt(id);
    const oid = parseInt(orderId);
    if (isNaN(businessId) || isNaN(oid)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }

    const access = await checkBusinessAccess(businessId, current.user.id, ["MANAGER", "SALES"]);
    if ("error" in access) {
      return NextResponse.json({ success: false, message: access.error }, { status: access.status });
    }
    if (!access.canWrite) {
      return NextResponse.json({ success: false, message: "لا تملك صلاحية تنفيذ إجراء" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = orderActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const stub = await prisma.wholesaleOrder.findUnique({
      where: { id: oid },
      select: { buyerBusinessId: true, sellerBusinessId: true },
    });
    if (!stub) {
      return NextResponse.json({ success: false, message: "الطلب غير موجود" }, { status: 404 });
    }

    const action = parsed.data.action;
    const requiredSide = ACTION_TO_SIDE[action];
    if (!requiredSide) {
      return NextResponse.json({ success: false, message: "إجراء غير معروف" }, { status: 400 });
    }

    const requiredBusinessId = requiredSide === "seller" ? stub.sellerBusinessId : stub.buyerBusinessId;
    if (requiredBusinessId !== businessId) {
      return NextResponse.json(
        { success: false, message: `هذا الإجراء يتطلب أن تكون ${requiredSide === "seller" ? "البائع" : "المشتري"}` },
        { status: 403 }
      );
    }

    let result: any;
    switch (action) {
      case "accept":
        result = await WholesaleOrderService.acceptOrder(oid, current.user.id);
        break;
      case "reject":
        result = await WholesaleOrderService.rejectOrder(oid, current.user.id, parsed.data.reason);
        break;
      case "prepare":
        result = await WholesaleOrderService.prepareOrder(oid, current.user.id);
        break;
      case "ship":
        result = await WholesaleOrderService.shipOrder(oid, current.user.id, {
          trackingNumber: parsed.data.trackingNumber,
          shippingCarrier: parsed.data.shippingCarrier,
        });
        break;
      case "deliver":
        result = await WholesaleOrderService.deliverOrder(oid, current.user.id);
        break;
      case "complete":
        result = await WholesaleOrderService.completeOrder(oid, current.user.id);
        break;
      case "cancel":
        result = await WholesaleOrderService.cancelOrder(oid, current.user.id, parsed.data.reason);
        break;
    }

    return NextResponse.json({ success: true, order: result });
  } catch (error) {
    console.error("Order action error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}