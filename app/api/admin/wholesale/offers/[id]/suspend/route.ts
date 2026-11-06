import { z } from "zod";
import {
  requireAdmin,
  parseJson,
  handleError,
  withIdempotency,
  fail,
  numericParam,
} from "@/lib/api";
import { WholesaleOfferService } from "@/services/wholesale-offer.service";

const suspendSchema = z.object({
  reason: z.string().trim().min(3, "سبب الإيقاف مطلوب").max(500),
});

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

    const parsed = await parseJson(request, suspendSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/admin/wholesale/offers/${offerId}/suspend`,
      parsed.data,
      async () => {
        await WholesaleOfferService.suspend(
          auth.current.user.id,
          offerId,
          parsed.data.reason
        );
        return { data: { suspended: true } };
      }
    );
  } catch (err) {
    return handleError(err, "POST /admin/wholesale/offers/[id]/suspend");
  }
}