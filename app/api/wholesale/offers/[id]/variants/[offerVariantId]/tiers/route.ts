import { z } from "zod";
import {
  requireAuth,
  parseJson,
  handleError,
  withIdempotency,
  fail,
  numericParam,
} from "@/lib/api";
import { WholesaleOfferService } from "@/services/wholesale-offer.service";

const tierSchema = z.object({
  minQty: z.number().int().positive(),
  maxQty: z.number().int().positive().optional().nullable(),
  unitPrice: z.number().positive().max(99999999.99),
});

const replaceSchema = z.object({
  tiers: z.array(tierSchema).min(1, "شريحة سعر واحدة على الأقل"),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; offerVariantId: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id, offerVariantId } = await params;
    const offerId = numericParam(id);
    const ovId = numericParam(offerVariantId);
    if (!offerId || !ovId) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, replaceSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `PUT:/api/wholesale/offers/${offerId}/variants/${ovId}/tiers`,
      parsed.data,
      async () => {
        await WholesaleOfferService.replaceTiers(
          auth.current.user.id,
          offerId,
          ovId,
          parsed.data.tiers
        );
        return { data: { replaced: true, count: parsed.data.tiers.length } };
      }
    );
  } catch (err) {
    return handleError(
      err,
      "PUT /wholesale/offers/[id]/variants/[offerVariantId]/tiers"
    );
  }
}