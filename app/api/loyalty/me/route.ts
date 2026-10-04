import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { LoyaltyService } from "@/services/loyalty.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    const info = await LoyaltyService.getFullInfo(current.user.id);

    return NextResponse.json({ success: true, ...info });
  } catch (error) {
    console.error("Loyalty me error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}