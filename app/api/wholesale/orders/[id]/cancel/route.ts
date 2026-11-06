import { z } from "zod";
import {
  requireAuth,
  parseJson,
  handleError,
  withIdempotency,
  fail,
  numericParam,
} from "@/lib/api";
import { WholesaleOrderService } from "@/services/wholesale-order.service";

const cancelSchema = z.object({
  reason: z.string().trim().min(3, "سبب الإلغاء مطلوب").max(500),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const orderId = numericParam(id);
    if (!orderId) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, cancelSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/wholesale/orders/${orderId}/cancel`,
      parsed.data,
      async () => {
        await WholesaleOrderService.cancel(
          auth.current.user.id,
          orderId,
          parsed.data.reason
        );
        return { data: { cancelled: true } };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/orders/[id]/cancel");
  }
}