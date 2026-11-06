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

const updateStatusSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]),
});

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

    const parsed = await parseJson(request, updateStatusSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `PATCH:/api/wholesale/products/${productId}/status`,
      parsed.data,
      async () => {
        await MerchantProductService.updateStatus(
          auth.current.user.id,
          productId,
          parsed.data.status
        );
        return { data: { status: parsed.data.status } };
      }
    );
  } catch (err) {
    return handleError(err, "PATCH /wholesale/products/[id]/status");
  }
}