import { z } from "zod";
import {
  requireAuth,
  parseJson,
  handleError,
  withIdempotency,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { WholesaleOfferService } from "@/services/wholesale-offer.service";

const updateSchema = z
  .object({
    wholesalePrice: z.number().positive().max(99999999.99).optional(),
    minOrderQty: z.number().int().positive().optional(),
    maxOrderQty: z.number().int().positive().optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, "لا يوجد تغيير");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const offerId = numericParam(id);
    if (!offerId) return fail("معرف غير صحيح", 400);

    const offer = await WholesaleOfferService.get(
      auth.current.user.id,
      offerId
    );
    return ok({ offer });
  } catch (err) {
    return handleError(err, "GET /wholesale/offers/[id]");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const offerId = numericParam(id);
    if (!offerId) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, updateSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `PATCH:/api/wholesale/offers/${offerId}`,
      parsed.data,
      async () => {
        await WholesaleOfferService.update(
          auth.current.user.id,
          offerId,
          parsed.data
        );
        return { data: { updated: true } };
      }
    );
  } catch (err) {
    return handleError(err, "PATCH /wholesale/offers/[id]");
  }
}