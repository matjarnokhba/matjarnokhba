import {
  requireAuth,
  handleError,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { WholesaleOrderService } from "@/services/wholesale-order.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const orderId = numericParam(id);
    if (!orderId) return fail("معرف غير صحيح", 400);

    const order = await WholesaleOrderService.get(
      auth.current.user.id,
      orderId
    );
    return ok({ order });
  } catch (err) {
    return handleError(err, "GET /wholesale/orders/[id]");
  }
}