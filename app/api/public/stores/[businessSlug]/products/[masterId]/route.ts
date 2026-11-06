import { handleError, ok, fail, numericParam } from "@/lib/api";
import { MerchantProductService } from "@/services/merchant-product.service";

export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ businessSlug: string; masterId: string }> }
) {
  try {
    const { businessSlug, masterId } = await params;
    const mId = numericParam(masterId);
    if (!mId) return fail("معرف غير صحيح", 400);
    if (!businessSlug || businessSlug.length < 1) {
      return fail("slug غير صحيح", 400);
    }

    const product = await MerchantProductService.getPublicBySlug(
      businessSlug,
      mId
    );
    if (!product) return fail("المنتج غير موجود", 404);
    return ok({ product });
  } catch (err) {
    return handleError(
      err,
      "GET /public/stores/[businessSlug]/products/[masterId]"
    );
  }
}