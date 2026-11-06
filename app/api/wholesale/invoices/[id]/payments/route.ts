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
    const invoiceId = numericParam(id);
    if (!invoiceId) return fail("معرف غير صحيح", 400);

    const allocations = await WholesalePaymentService.listByInvoice(
      auth.current.user.id,
      invoiceId
    );
    return ok({ allocations });
  } catch (err) {
    return handleError(err, "GET /wholesale/invoices/[id]/payments");
  }
}