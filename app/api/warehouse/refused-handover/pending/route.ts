import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { RefusedHandoverService } from "@/services/refused-handover.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (
      !current ||
      !["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(current.user.role)
    ) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const drivers = await RefusedHandoverService.getPendingDrivers(
      current.user.id
    );

    return NextResponse.json({ success: true, drivers });
  } catch (error) {
    console.error("Refused handover pending error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}