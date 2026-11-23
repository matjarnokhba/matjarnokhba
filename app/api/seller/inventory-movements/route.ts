import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/seller-guards";
import { loadMovementHistory } from "@/lib/stock-history";

export async function GET(request: Request) {
  try {
    const guard = await requireStaffPermission("VIEW_STOCK_HISTORY");
    if (!guard.ok) return guard.response;
    const sellerId = guard.current.user.seller!.id;

    const url = new URL(request.url);
    const int = (k: string) => {
      const n = parseInt(url.searchParams.get(k) || "", 10);
      return Number.isInteger(n) && n > 0 ? n : undefined;
    };
    const bucketParam = url.searchParams.get("bucket");
    const bucket = bucketParam === "SELLABLE" || bucketParam === "DEFECTIVE" ? bucketParam : undefined;
    const page = int("page") ?? 1;
    const limit = Math.min(100, int("limit") ?? 30);

    const data = await loadMovementHistory(prisma, {
      sellerId,
      variantId: int("variantId"),
      productId: int("productId"),
      bucket,
      page,
      limit,
    });
    return NextResponse.json({ success: true, ...data });
  } catch (e) {
    console.error("Inventory history error:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ غير متوقع" }, { status: 500 });
  }
}