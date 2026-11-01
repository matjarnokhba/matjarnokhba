import { NextResponse } from "next/server";
import { ProductMasterService } from "@/services/product-master.service";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const result = await ProductMasterService.listMasters({
      verifiedOnly: true,
      page: parseInt(url.searchParams.get("page") || "1"),
      pageSize: parseInt(url.searchParams.get("pageSize") || "30"),
      search: url.searchParams.get("search") || undefined,
      categoryId: url.searchParams.get("categoryId") ? parseInt(url.searchParams.get("categoryId")!) : undefined,
      brand: url.searchParams.get("brand") || undefined,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Masters browse error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}