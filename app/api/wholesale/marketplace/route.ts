import { requireAuth, handleError, ok } from "@/lib/api";
import { WholesaleOfferService } from "@/services/wholesale-offer.service";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const categoryIdRaw = url.searchParams.get("categoryId");
    const categoryId = categoryIdRaw ? parseInt(categoryIdRaw, 10) : undefined;
    const businessTypeRaw = url.searchParams.get("businessType");
    const businessType = businessTypeRaw
      ? (businessTypeRaw as
          | "FACTORY"
          | "SHOP"
          | "BRANCH"
          | "IMPORTER"
          | "WHOLESALER"
          | "DISTRIBUTOR")
      : undefined;
    const claimVerifiedRaw = url.searchParams.get("claimVerified");
    const claimVerified =
      claimVerifiedRaw === "true"
        ? true
        : claimVerifiedRaw === "false"
        ? false
        : undefined;
    const minPriceRaw = url.searchParams.get("minPrice");
    const maxPriceRaw = url.searchParams.get("maxPrice");
    const search = url.searchParams.get("search") || undefined;
    const pageRaw = url.searchParams.get("page");
    const pageSizeRaw = url.searchParams.get("pageSize");

    const result = await WholesaleOfferService.listPublic({
      categoryId: categoryId && !isNaN(categoryId) ? categoryId : undefined,
      businessType,
      claimVerified,
      minPrice: minPriceRaw ? parseFloat(minPriceRaw) : undefined,
      maxPrice: maxPriceRaw ? parseFloat(maxPriceRaw) : undefined,
      search,
      page: pageRaw ? parseInt(pageRaw, 10) : 1,
      pageSize: pageSizeRaw ? parseInt(pageSizeRaw, 10) : 30,
    });

    return ok(result);
  } catch (err) {
    return handleError(err, "GET /wholesale/marketplace");
  }
}