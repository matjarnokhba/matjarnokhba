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

const createSellingUnitSchema = z.object({
  name: z.string().trim().min(1).max(50),
  conversionFactor: z.number().int().positive(),
  price: z.number().nonnegative().max(99999999.99),
  isActive: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const productId = numericParam(id);
    if (!productId) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, createSellingUnitSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/wholesale/products/${productId}/selling-units`,
      parsed.data,
      async () => {
        const unitId = await MerchantProductService.addSellingUnit(
          auth.current.user.id,
          productId,
          parsed.data
        );
        return { data: { unitId }, status: 201 };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/products/[id]/selling-units");
  }
}