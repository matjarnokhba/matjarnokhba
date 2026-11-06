import {
  requireAuth,
  handleError,
  withIdempotency,
  fail,
  numericParam,
} from "@/lib/api";
import { WholesaleOfferService } from "@/services/wholesale-offer.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const offerId = numericParam(id);
    if (!offerId) return fail("معرف غير صحيح", 400);

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/wholesale/offers/${offerId}/resume`,
      { offerId },
      async () => {
        await WholesaleOfferService.resume(auth.current.user.id, offerId);
        return { data: { resumed: true } };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/offers/[id]/resume");
  }
}