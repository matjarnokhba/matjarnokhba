import {
  requireAuth,
  handleError,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { WholesaleInvoiceService } from "@/services/wholesale-invoice.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const businessUnitId = numericParam(id);
    if (!businessUnitId) return fail("معرف غير صحيح", 400);

    const url = new URL(request.url);
    const invoiceType = url.searchParams.get("invoiceType") as
      | "SALE"
      | "PURCHASE"
      | "CREDIT_NOTE"
      | "DEBIT_NOTE"
      | null;
    const status = url.searchParams.get("status") as
      | "DRAFT"
      | "ISSUED"
      | "PARTIALLY_PAID"
      | "PAID"
      | "CANCELLED"
      | "VOID"
      | null;
    const fromRaw = url.searchParams.get("from");
    const toRaw = url.searchParams.get("to");
    const pageRaw = url.searchParams.get("page");
    const pageSizeRaw = url.searchParams.get("pageSize");

    const result = await WholesaleInvoiceService.listByBusinessUnit(
      auth.current.user.id,
      businessUnitId,
      {
        invoiceType: invoiceType ?? undefined,
        status: status ?? undefined,
        from: fromRaw ? new Date(fromRaw) : undefined,
        to: toRaw ? new Date(toRaw) : undefined,
        page: pageRaw ? parseInt(pageRaw, 10) : 1,
        pageSize: pageSizeRaw ? parseInt(pageSizeRaw, 10) : 30,
      }
    );

    return ok(result);
  } catch (err) {
    return handleError(err, "GET /wholesale/business-units/[id]/invoices");
  }
}