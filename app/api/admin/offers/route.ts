import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { WholesaleOfferService } from "@/services/wholesale-offer.service";

export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !["ADMIN", "SUPER_ADMIN"].includes(current.user.role)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const url = new URL(request.url);
    const result = await WholesaleOfferService.listPendingClaims(
      parseInt(url.searchParams.get("page") || "1"),
      parseInt(url.searchParams.get("pageSize") || "30")
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Admin offers list error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}