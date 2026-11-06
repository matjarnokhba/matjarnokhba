import {
  requireAuth,
  handleError,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { WholesalePaymentService } from "@/services/wholesale-payment.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const paymentId = numericParam(id);
    if (!paymentId) return fail("معرف غير صحيح", 400);

    const payment = await WholesalePaymentService.get(
      auth.current.user.id,
      paymentId
    );
    return ok({ payment });
  } catch (err) {
    return handleError(err, "GET /wholesale/payments/[id]");
  }
}