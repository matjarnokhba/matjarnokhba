import {
  requireAuth,
  handleError,
  withIdempotency,
  fail,
  numericParam,
} from "@/lib/api";
import { MerchantProductService } from "@/services/merchant-product.service";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id, unitId } = await params;
    const productId = numericParam(id);
    const uId = numericParam(unitId);
    if (!productId || !uId) return fail("معرف غير صحيح", 400);

    return await withIdempotency(
      request,
      auth.current.user.id,
      `DELETE:/api/wholesale/products/${productId}/selling-units/${uId}`,
      { productId, unitId: uId },
      async () => {
        await MerchantProductService.deactivateSellingUnit(
          auth.current.user.id,
          uId
        );
        return { data: { deactivated: true } };
      }
    );
  } catch (err) {
    return handleError(
      err,
      "DELETE /wholesale/products/[id]/selling-units/[unitId]"
    );
  }
}