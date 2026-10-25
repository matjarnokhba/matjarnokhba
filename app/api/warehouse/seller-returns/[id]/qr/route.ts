import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { SellerReturnService } from "@/services/seller-return.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const batchId = parseInt(id);
    if (isNaN(batchId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const result = await SellerReturnService.getRawTokenForBatch(batchId);

    if (!result.token) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          status: result.status,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, qrToken: result.token });
  } catch (error) {
    console.error("Get batch QR error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}