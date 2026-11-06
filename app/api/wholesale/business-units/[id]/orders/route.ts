import {
  requireAuth,
  handleError,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { WholesaleOrderService } from "@/services/wholesale-order.service";

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
    const direction = (url.searchParams.get("direction") || "buyer") as
      | "buyer"
      | "seller";
    const statusRaw = url.searchParams.get("status");
    const status = statusRaw
      ? (statusRaw as
          | "PENDING"
          | "CONFIRMED"
          | "PROCESSING"
          | "READY"
          | "SHIPPED"
          | "DELIVERED"
          | "CANCELLED"
          | "RETURNED"
          | "DISPUTED")
      : undefined;
    const pageRaw = url.searchParams.get("page");
    const pageSizeRaw = url.searchParams.get("pageSize");
    const page = pageRaw ? parseInt(pageRaw, 10) : 1;
    const pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : 30;

    const result =
      direction === "seller"
        ? await WholesaleOrderService.listBySeller(
            auth.current.user.id,
            businessUnitId,
            { status, page, pageSize }
          )
        : await WholesaleOrderService.listByBuyer(
            auth.current.user.id,
            businessUnitId,
            { status, page, pageSize }
          );

    return ok(result);
  } catch (err) {
    return handleError(err, "GET /wholesale/business-units/[id]/orders");
  }
}