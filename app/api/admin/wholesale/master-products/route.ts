import { requireAdmin, handleError, ok } from "@/lib/api";
import { MasterProductService } from "@/services/master-product.service";

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const statusRaw = url.searchParams.get("status");
    const status = statusRaw
      ? (statusRaw as "PENDING_REVIEW" | "ACTIVE" | "SUSPENDED" | "ARCHIVED")
      : undefined;
    const categoryIdRaw = url.searchParams.get("categoryId");
    const categoryId = categoryIdRaw ? parseInt(categoryIdRaw, 10) : undefined;
    const search = url.searchParams.get("search") || undefined;
    const pageRaw = url.searchParams.get("page");
    const pageSizeRaw = url.searchParams.get("pageSize");

    const result = await MasterProductService.list({
      status,
      categoryId: categoryId && !isNaN(categoryId) ? categoryId : undefined,
      search,
      page: pageRaw ? parseInt(pageRaw, 10) : 1,
      pageSize: pageSizeRaw ? parseInt(pageSizeRaw, 10) : 30,
    });

    return ok(result);
  } catch (err) {
    return handleError(err, "GET /admin/wholesale/master-products");
  }
}