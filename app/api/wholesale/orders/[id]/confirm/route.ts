import {
  requireAuth,
  handleError,
  withIdempotency,
  fail,
  numericParam,
} from "@/lib/api";
import { WholesaleOrderService } from "@/services/wholesale-order.service";

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

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/wholesale/orders/${orderId}/confirm`,
      { orderId },
      async () => {
        await WholesaleOrderService.confirm(auth.current.user.id, orderId);
        return { data: { confirmed: true } };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/orders/[id]/confirm");
  }
}