import { handleError, ok, fail, numericParam } from "@/lib/api";
import { WholesaleOfferService } from "@/services/wholesale-offer.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const offerId = numericParam(id);
    if (!offerId) return fail("معرف غير صحيح", 400);

    const offer = await WholesaleOfferService.getPublic(offerId);
    if (!offer) return fail("العرض غير موجود", 404);
    return ok({ offer });
  } catch (err) {
    return handleError(err, "GET /wholesale/offers/[id]/public");
  }
}