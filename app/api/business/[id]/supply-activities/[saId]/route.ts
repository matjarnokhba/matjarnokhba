import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { checkBusinessAccess } from "@/lib/business-access";
import { supplyActivityUpdateSchema } from "@/lib/supply-activity-validation";
import { SupplyActivityService } from "@/services/supply-activity.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; saId: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });

    const { id, saId } = await params;
    const businessId = parseInt(id);
    const sid = parseInt(saId);
    if (isNaN(businessId) || isNaN(sid)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }

    const access = await checkBusinessAccess(businessId, current.user.id);
    if ("error" in access) return NextResponse.json({ success: false, message: access.error }, { status: access.status });

    const sa = await SupplyActivityService.getOne(businessId, sid);
    if (!sa) return NextResponse.json({ success: false, message: "الهوية غير موجودة" }, { status: 404 });
    return NextResponse.json({ success: true, activity: sa });
  } catch (error) {
    console.error("SA get error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; saId: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });

    const { id, saId } = await params;
    const businessId = parseInt(id);
    const sid = parseInt(saId);
    if (isNaN(businessId) || isNaN(sid)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = supplyActivityUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const updated = await SupplyActivityService.updateForTrader(businessId, current.user.id, sid, parsed.data);
    return NextResponse.json({ success: true, activity: updated });
  } catch (error) {
    console.error("SA update error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}