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

    const batches = await RefusedHandoverService.getActiveBatches();
    return NextResponse.json({ success: true, batches });
  } catch (error) {
    console.error("Active refused handover GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}