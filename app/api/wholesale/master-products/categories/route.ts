import { requireAuth, handleError, ok } from "@/lib/api";
import { MasterProductService } from "@/services/master-product.service";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const categories = await MasterProductService.listCategories(true);
    return ok({ categories });
  } catch (err) {
    return handleError(err, "GET /wholesale/master-products/categories");
  }
}