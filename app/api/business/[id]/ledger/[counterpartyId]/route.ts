import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { checkBusinessAccess } from "@/lib/business-access";
import { LedgerService } from "@/services/ledger.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; counterpartyId: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const { id, counterpartyId } = await params;
    const businessId = parseInt(id);
    const cpId = parseInt(counterpartyId);
    if (isNaN(businessId) || isNaN(cpId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }
    const access = await checkBusinessAccess(businessId, current.user.id);
    if ("error" in access) {
      return NextResponse.json({ success: false, message: access.error }, { status: access.status });
    }
    const result = await LedgerService.getAccountDetail(businessId, cpId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Ledger detail error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}