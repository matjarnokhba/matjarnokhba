import { z } from "zod";
import {
  requireAuth,
  parseJson,
  handleError,
  withIdempotency,
} from "@/lib/api";
import { WholesaleOrderService } from "@/services/wholesale-order.service";

const itemSchema = z.object({
  offerId: z.number().int().positive(),
  masterVariantId: z.number().int().positive(),
  quantity: z.number().int().positive().max(100000),
});

const createSchema = z.object({
  buyerBusinessUnitId: z.number().int().positive(),
  items: z.array(itemSchema).min(1, "السلة فارغة").max(200),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const parsed = await parseJson(request, createSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      "POST:/api/wholesale/orders",
      parsed.data,
      async () => {
        const result = await WholesaleOrderService.create(
          auth.current.user.id,
          parsed.data
        );
        return { data: result, status: 201 };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/orders");
  }
}