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

    const sellers = await SellerReturnService.getPendingBySeller();

    return NextResponse.json({ success: true, sellers });
  } catch (error) {
    console.error("Seller returns pending error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}