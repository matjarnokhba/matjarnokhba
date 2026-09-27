import { NextResponse } from "next/server";
import { z } from "zod";
import { SessionService } from "@/services/session.service";
import { ReturnService } from "@/services/return.service";

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("reject"),
    adminNote: z.string().trim().max(500).optional(),
  }),
  z.object({ action: z.literal("complete") }),
]);

// ═══════ GET — تفاصيل طلب إرجاع ═══════
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const returnId = parseInt(id);
    if (isNaN(returnId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const ret = await ReturnService.getById(returnId);
    if (!ret) {
      return NextResponse.json(
        { success: false, message: "طلب الإرجاع غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, returnRequest: ret });
  } catch (error) {
    console.error("Admin return detail error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ PATCH — approve/reject/complete ═══════
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const returnId = parseInt(id);
    if (isNaN(returnId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "إجراء غير صحيح" },
        { status: 400 }
      );
    }

    if (parsed.data.action === "approve") {
      await ReturnService.approve(returnId, auth.user.id);
      return NextResponse.json({ success: true, message: "تمت الموافقة" });
    }

    if (parsed.data.action === "reject") {
      await ReturnService.reject(
        returnId,
        auth.user.id,
        parsed.data.adminNote || ""
      );
      return NextResponse.json({ success: true, message: "تم الرفض" });
    }

    if (parsed.data.action === "complete") {
      const result = await ReturnService.complete(returnId, auth.user.id);
      return NextResponse.json({
        success: true,
        message: "تم إكمال الإرجاع",
        isFullReturn: result.isFullReturn,
      });
    }

    return NextResponse.json(
      { success: false, message: "إجراء غير معروف" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Admin return PATCH error:", error);
    const message = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}