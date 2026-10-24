import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { SellerReturnService } from "@/services/seller-return.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "SELLER" || !current.user.seller) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const batches = await SellerReturnService.getBySeller(current.user.id);

    return NextResponse.json({ success: true, batches });
  } catch (error) {
    console.error("Seller batches GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}