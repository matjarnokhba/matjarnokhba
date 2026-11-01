import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { checkBusinessAccess } from "@/lib/business-access";
import { WholesaleReturnService } from "@/services/wholesale-return.service";

export async function GET(
  _request: Request,
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

    const access = await checkBusinessAccess(businessId, current.user.id);
    if ("error" in access) return NextResponse.json({ success: false, message: access.error }, { status: access.status });

    const ret = await prisma.wholesaleReturnRequest.findUnique({
      where: { id: rid },
      select: { buyerBusinessId: true, sellerBusinessId: true },
    });
    if (!ret) return NextResponse.json({ success: false, message: "المرتجع غير موجود" }, { status: 404 });
    if (ret.buyerBusinessId !== businessId && ret.sellerBusinessId !== businessId) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const full = await WholesaleReturnService.getReturn(rid);
    const side = ret.buyerBusinessId === businessId ? "buyer" : "seller";
    return NextResponse.json({ success: true, return: full, side });
  } catch (error) {
    console.error("Return detail error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}