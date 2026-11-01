import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { WholesaleOrderService } from "@/services/wholesale-order.service";
import { checkBusinessAccess } from "@/lib/business-access";

export async function GET(
  _request: Request,
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

    const access = await checkBusinessAccess(businessId, current.user.id);
    if ("error" in access) {
      return NextResponse.json({ success: false, message: access.error }, { status: access.status });
    }

    const stub = await prisma.wholesaleOrder.findUnique({
      where: { id: oid },
      select: { buyerBusinessId: true, sellerBusinessId: true },
    });
    if (!stub) {
      return NextResponse.json({ success: false, message: "الطلب غير موجود" }, { status: 404 });
    }
    const isParty = stub.buyerBusinessId === businessId || stub.sellerBusinessId === businessId;
    if (!isParty) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const order = await WholesaleOrderService.getOrder(oid);
    if (!order) {
      return NextResponse.json({ success: false, message: "الطلب غير موجود" }, { status: 404 });
    }

    const side = stub.buyerBusinessId === businessId ? "buyer" : "seller";
    return NextResponse.json({ success: true, order, side });
  } catch (error) {
    console.error("Order detail error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}