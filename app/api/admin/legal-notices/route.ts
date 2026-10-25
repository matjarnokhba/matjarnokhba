import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { LegalNoticeService } from "@/services/legal-notice.service";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const filter = (searchParams.get("filter") || "ALL") as
      | "WARNING"
      | "ESCALATED"
      | "RESOLVED"
      | "ALL";

    const notices = await LegalNoticeService.getAll(filter);
    return NextResponse.json({ success: true, notices });
  } catch (error) {
    console.error("Legal notices GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}