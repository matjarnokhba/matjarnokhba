import { z } from "zod";
import {
  requireAuth,
  parseJson,
  handleError,
  withIdempotency,
  fail,
  numericParam,
} from "@/lib/api";
import { MerchantProductService } from "@/services/merchant-product.service";

const updateVariantSchema = z
  .object({
    baseUnitPrice: z.number().nonnegative().max(99999999.99).optional(),
    barcode: z.string().trim().max(100).optional().nullable(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "لا يوجد تغيير");

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id, variantId } = await params;
    const productId = numericParam(id);
    const vId = numericParam(variantId);
    if (!productId || !vId) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, updateVariantSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `PATCH:/api/wholesale/products/${productId}/variants/${vId}`,
      parsed.data,
      async () => {
        await MerchantProductService.updateVariant(
          auth.current.user.id,
          vId,
          parsed.data
        );
        return { data: { updated: true } };
      }
    );
  } catch (err) {
    return handleError(err, "PATCH /wholesale/products/[id]/variants/[variantId]");
  }
}