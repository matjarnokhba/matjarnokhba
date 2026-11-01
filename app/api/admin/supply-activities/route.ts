import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { SupplyActivityService } from "@/services/supply-activity.service";

export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !["ADMIN", "SUPER_ADMIN"].includes(current.user.role)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const url = new URL(request.url);
    const result = await SupplyActivityService.adminListPending(
      parseInt(url.searchParams.get("page") || "1"),
      parseInt(url.searchParams.get("pageSize") || "30")
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Admin SA list error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}