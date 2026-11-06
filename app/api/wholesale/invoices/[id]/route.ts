import {
  requireAuth,
  handleError,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { WholesaleInvoiceService } from "@/services/wholesale-invoice.service";

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

    const invoice = await WholesaleInvoiceService.get(
      auth.current.user.id,
      invoiceId
    );
    return ok({ invoice });
  } catch (err) {
    return handleError(err, "GET /wholesale/invoices/[id]");
  }
}