import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { supplyActivityVerifySchema } from "@/lib/supply-activity-validation";
import { SupplyActivityService } from "@/services/supply-activity.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !["ADMIN", "SUPER_ADMIN"].includes(current.user.role)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const { id } = await params;
    const saId = parseInt(id);
    if (isNaN(saId)) return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });

    const body = await request.json();
    const parsed = supplyActivityVerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }
    const result = await SupplyActivityService.adminVerify(
      saId,
      current.user.id,
      parsed.data.approve,
      parsed.data.reason
    );
    return NextResponse.json({ success: true, activity: result });
  } catch (error) {
    console.error("Admin SA verify error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}