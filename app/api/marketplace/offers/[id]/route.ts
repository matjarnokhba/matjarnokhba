import { NextResponse } from "next/server";
import { WholesaleOfferService } from "@/services/wholesale-offer.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const offerId = parseInt(id);
    if (isNaN(offerId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }
    const offer = await WholesaleOfferService.getPublicOffer(offerId);
    if (!offer) {
      return NextResponse.json({ success: false, message: "العرض غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ success: true, offer });
  } catch (error) {
    console.error("Marketplace detail error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}