import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { SellerReturnService } from "@/services/seller-return.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "COLLECTOR") {
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

    const token = await SellerReturnService.getRawTokenForCollector(
      batchId,
      current.user.id
    );

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "لا يمكن عرض QR — الدفعة قد سُلّمت للتاجر أو غير متاحة",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, qrToken: token });
  } catch (error) {
    console.error("Collector batch QR error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}