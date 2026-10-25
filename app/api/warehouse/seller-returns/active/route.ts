import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { SellerReturnService } from "@/services/seller-return.service";

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

    const batches = await SellerReturnService.getActiveBatches();
    return NextResponse.json({ success: true, batches });
  } catch (error) {
    console.error("Active seller returns GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}