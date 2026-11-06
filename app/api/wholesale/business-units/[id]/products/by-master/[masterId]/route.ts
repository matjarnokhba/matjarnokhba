import {
  requireAuth,
  handleError,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { MerchantProductService } from "@/services/merchant-product.service";
import { getBusinessUnitContext } from "@/lib/wholesale/context";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; masterId: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id, masterId } = await params;
    const businessUnitId = numericParam(id);
    const mId = numericParam(masterId);
    if (!businessUnitId || !mId) return fail("معرف غير صحيح", 400);

    // Auth check via context
    await getBusinessUnitContext(auth.current.user.id, businessUnitId);

    const product = await MerchantProductService.getByMaster(
      businessUnitId,
      mId
    );
    if (!product) return ok({ product: null });
    return ok({ product });
  } catch (err) {
    return handleError(
      err,
      "GET /wholesale/business-units/[id]/products/by-master/[masterId]"
    );
  }
}