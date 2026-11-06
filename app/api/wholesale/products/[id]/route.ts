import { z } from "zod";
import {
  requireAuth,
  parseJson,
  handleError,
  withIdempotency,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { MerchantProductService } from "@/services/merchant-product.service";

const updateDisplaySchema = z
  .object({
    displayName: z.string().trim().min(2).max(200).optional(),
    displayImages: z.array(z.string().url()).min(1).max(10).optional(),
    displayDescription: z.string().trim().max(2000).optional().nullable(),
    retailPrice: z.number().nonnegative().max(99999999.99).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "لا يوجد تغيير");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const productId = numericParam(id);
    if (!productId) return fail("معرف غير صحيح", 400);

    const product = await MerchantProductService.get(
      auth.current.user.id,
      productId
    );
    return ok({ product });
  } catch (err) {
    return handleError(err, "GET /wholesale/products/[id]");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const productId = numericParam(id);
    if (!productId) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, updateDisplaySchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `PATCH:/api/wholesale/products/${productId}`,
      parsed.data,
      async () => {
        await MerchantProductService.updateDisplay(
          auth.current.user.id,
          productId,
          parsed.data
        );
        return { data: { updated: true } };
      }
    );
  } catch (err) {
    return handleError(err, "PATCH /wholesale/products/[id]");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const productId = numericParam(id);
    if (!productId) return fail("معرف غير صحيح", 400);

    return await withIdempotency(
      request,
      auth.current.user.id,
      `DELETE:/api/wholesale/products/${productId}`,
      { productId },
      async () => {
        await MerchantProductService.softDelete(
          auth.current.user.id,
          productId
        );
        return { data: { deleted: true } };
      }
    );
  } catch (err) {
    return handleError(err, "DELETE /wholesale/products/[id]");
  }
}