import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { checkBusinessAccess } from "@/lib/business-access";
import { returnActionSchema } from "@/lib/wholesale-return-validation";
import { WholesaleReturnService } from "@/services/wholesale-return.service";

const ACTION_TO_SIDE: Record<string, "buyer" | "seller"> = {
  approve: "seller",
  reject: "seller",
  receive: "seller",
  refund: "seller",
  cancel: "buyer",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; returnId: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });

    const { id, returnId } = await params;
    const businessId = parseInt(id);
    const rid = parseInt(returnId);
    if (isNaN(businessId) || isNaN(rid)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }

    const access = await checkBusinessAccess(businessId, current.user.id, ["MANAGER", "SALES", "ACCOUNTANT", "INVENTORY"]);
    if ("error" in access) return NextResponse.json({ success: false, message: access.error }, { status: access.status });
    if (!access.canWrite) return NextResponse.json({ success: false, message: "لا تملك صلاحية تنفيذ إجراء" }, { status: 403 });

    const body = await request.json();
    const parsed = returnActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" }, { status: 400 });
    }

    const ret = await prisma.wholesaleReturnRequest.findUnique({
      where: { id: rid },
      select: { buyerBusinessId: true, sellerBusinessId: true },
    });
    if (!ret) return NextResponse.json({ success: false, message: "المرتجع غير موجود" }, { status: 404 });

    const action = parsed.data.action;
    const requiredSide = ACTION_TO_SIDE[action];
    const requiredBusinessId = requiredSide === "seller" ? ret.sellerBusinessId : ret.buyerBusinessId;
    if (requiredBusinessId !== businessId) {
      return NextResponse.json(
        { success: false, message: `هذا الإجراء يتطلب أن تكون ${requiredSide === "seller" ? "البائع" : "المشتري"}` },
        { status: 403 }
      );
    }

    let result: any;
    switch (action) {
      case "approve":
        result = await WholesaleReturnService.approveReturn(rid, businessId, current.user.id, parsed.data.approvedAmount, parsed.data.sellerNotes);
        break;
      case "reject":
        result = await WholesaleReturnService.rejectReturn(rid, businessId, current.user.id, parsed.data.rejectionReason);
        break;
      case "receive":
        result = await WholesaleReturnService.receiveReturn(rid, businessId, current.user.id);
        break;
      case "refund":
        result = await WholesaleReturnService.refundReturn(rid, businessId, current.user.id);
        break;
      case "cancel":
        result = await WholesaleReturnService.cancelReturn(rid, businessId, current.user.id);
        break;
    }
    return NextResponse.json({ success: true, return: result });
  } catch (error) {
    console.error("Return action error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}