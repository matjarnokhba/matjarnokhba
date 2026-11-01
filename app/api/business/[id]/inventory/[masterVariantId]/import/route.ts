import { NextResponse } from "next/server";
import { z } from "zod";
import { SessionService } from "@/services/session.service";
import { checkBusinessAccess } from "@/lib/business-access";
import { RetailImportService } from "@/services/retail-import.service";

const schema = z.object({
  quantity: z.number().int().positive(),
  retailPrice: z.number().positive(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; masterVariantId: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const { id, masterVariantId } = await params;
    const businessId = parseInt(id);
    const mvId = parseInt(masterVariantId);
    if (isNaN(businessId) || isNaN(mvId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }

    const access = await checkBusinessAccess(businessId, current.user.id, ["MANAGER", "SALES", "INVENTORY"]);
    if ("error" in access) {
      return NextResponse.json({ success: false, message: access.error }, { status: access.status });
    }
    if (!access.canWrite) {
      return NextResponse.json({ success: false, message: "لا تملك صلاحية الاستيراد" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const result = await RetailImportService.importToRetail({
      businessId,
      masterVariantId: mvId,
      quantity: parsed.data.quantity,
      retailPrice: parsed.data.retailPrice,
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error("Retail import error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}