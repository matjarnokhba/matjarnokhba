import {
  requireAdmin,
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
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const offerId = numericParam(id);
    if (!offerId) return fail("معرف غير صحيح", 400);

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/admin/wholesale/offers/${offerId}/restore`,
      { offerId },
      async () => {
        await WholesaleOfferService.restore(auth.current.user.id, offerId);
        return { data: { restored: true } };
      }
    );
  } catch (err) {
    return handleError(err, "POST /admin/wholesale/offers/[id]/restore");
  }
}