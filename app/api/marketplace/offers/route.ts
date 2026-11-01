import { NextResponse } from "next/server";
import { WholesaleOfferService } from "@/services/wholesale-offer.service";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const result = await WholesaleOfferService.listPublicOffers({
      categoryId: url.searchParams.get("categoryId") ? parseInt(url.searchParams.get("categoryId")!) : undefined,
      businessType: url.searchParams.get("businessType") || undefined,
      city: url.searchParams.get("city") || undefined,
      search: url.searchParams.get("search") || undefined,
      minPrice: url.searchParams.get("minPrice") ? Number(url.searchParams.get("minPrice")) : undefined,
      maxPrice: url.searchParams.get("maxPrice") ? Number(url.searchParams.get("maxPrice")) : undefined,
      page: parseInt(url.searchParams.get("page") || "1"),
      pageSize: parseInt(url.searchParams.get("pageSize") || "30"),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Marketplace list error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}