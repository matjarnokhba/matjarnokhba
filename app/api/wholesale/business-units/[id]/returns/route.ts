import {
  requireAuth,
  handleError,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { WholesaleReturnService } from "@/services/wholesale-return.service";

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
    const direction = url.searchParams.get("direction") as
      | "buyer"
      | "seller"
      | null;
    const statusRaw = url.searchParams.get("status");
    const status = statusRaw
      ? (statusRaw as
          | "REQUESTED"
          | "APPROVED"
          | "REJECTED"
          | "PENDING_SHIPMENT"
          | "RECEIVED"
          | "INSPECTED"
          | "PARTIALLY_ACCEPTED"
          | "COMPLETED"
          | "CANCELLED")
      : undefined;
    const pageRaw = url.searchParams.get("page");
    const pageSizeRaw = url.searchParams.get("pageSize");

    const result = await WholesaleReturnService.listByBusinessUnit(
      auth.current.user.id,
      businessUnitId,
      {
        direction: direction ?? undefined,
        status,
        page: pageRaw ? parseInt(pageRaw, 10) : 1,
        pageSize: pageSizeRaw ? parseInt(pageSizeRaw, 10) : 30,
      }
    );

    return ok(result);
  } catch (err) {
    return handleError(err, "GET /wholesale/business-units/[id]/returns");
  }
}