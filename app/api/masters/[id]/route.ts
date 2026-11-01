import { NextResponse } from "next/server";
import { ProductMasterService } from "@/services/product-master.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mid = parseInt(id);
    if (isNaN(mid)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }
    const master = await ProductMasterService.getMaster(mid);
    if (!master || !master.isVerified) {
      return NextResponse.json({ success: false, message: "المنتج غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ success: true, master });
  } catch (error) {
    console.error("Master public GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}