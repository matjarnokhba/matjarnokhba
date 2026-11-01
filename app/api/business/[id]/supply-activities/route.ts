import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { checkBusinessAccess } from "@/lib/business-access";
import { supplyActivityCreateSchema } from "@/lib/supply-activity-validation";
import { SupplyActivityService } from "@/services/supply-activity.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });

    const { id } = await params;
    const businessId = parseInt(id);
    if (isNaN(businessId)) return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });

    const access = await checkBusinessAccess(businessId, current.user.id);
    if ("error" in access) return NextResponse.json({ success: false, message: access.error }, { status: access.status });

    const activities = await SupplyActivityService.listForBusiness(businessId);
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { type: true, status: true },
    });
    const canAdd = biz?.type === "WHOLESALE_TRADER" && biz?.status === "VERIFIED" && access.isOwner;

    return NextResponse.json({ success: true, activities, canAdd });
  } catch (error) {
    console.error("SA list error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });

    const { id } = await params;
    const businessId = parseInt(id);
    if (isNaN(businessId)) return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });

    const body = await request.json();
    const parsed = supplyActivityCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const sa = await SupplyActivityService.createForTrader(businessId, current.user.id, parsed.data);
    return NextResponse.json({ success: true, activity: sa }, { status: 201 });
  } catch (error) {
    console.error("SA create error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}