import { NextResponse } from "next/server";
import { z } from "zod";
import { SessionService } from "@/services/session.service";
import { checkBusinessAccess } from "@/lib/business-access";
import { returnCreateSchema } from "@/lib/wholesale-return-validation";
import { WholesaleReturnService } from "@/services/wholesale-return.service";
import { isWholesaleTrader } from "@/lib/business-type-guards";

const listQuerySchema = z.object({
  side: z.enum(["buyer", "seller"]).default("buyer"),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

const createBodySchema = z.object({
  orderId: z.number().int().positive(),
}).merge(returnCreateSchema);

export async function GET(
  request: Request,
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

    const url = new URL(request.url);
    const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return NextResponse.json({ success: false, message: "معاملات غير صحيحة" }, { status: 400 });

    const result = await WholesaleReturnService.listReturns(businessId, parsed.data.side, {
      status: parsed.data.status,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Returns GET error:", error);
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

    const access = await checkBusinessAccess(businessId, current.user.id, ["MANAGER", "SALES", "INVENTORY"]);
    if ("error" in access) return NextResponse.json({ success: false, message: access.error }, { status: access.status });
    if (!access.canWrite) return NextResponse.json({ success: false, message: "لا تملك صلاحية إنشاء مرتجع" }, { status: 403 });

    if (!(await isWholesaleTrader(businessId))) {
      return NextResponse.json(
        { success: false, message: "المرتجعات متاحة لتجار الجملة فقط" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" }, { status: 400 });
    }

    const ret = await WholesaleReturnService.createReturn({
      orderId: parsed.data.orderId,
      buyerBusinessId: businessId,
      userId: current.user.id,
      reason: parsed.data.reason,
      reasonDetails: parsed.data.reasonDetails,
      items: parsed.data.items,
    });
    return NextResponse.json({ success: true, return: ret }, { status: 201 });
  } catch (error) {
    console.error("Returns POST error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}