import { NextResponse } from "next/server";
import { z } from "zod";
import { SessionService } from "@/services/session.service";
import { LegalNoticeService } from "@/services/legal-notice.service";

const schema = z.object({
  note: z.string().trim().min(3, "الملاحظة مطلوبة (3 أحرف)").max(500),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (
      !current ||
      (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const noticeId = parseInt(id);
    if (isNaN(noticeId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    await LegalNoticeService.resolveManually(noticeId, parsed.data.note);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Resolve notice error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}