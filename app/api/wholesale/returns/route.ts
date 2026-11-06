import { z } from "zod";
import {
  requireAuth,
  parseJson,
  handleError,
  withIdempotency,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { WholesaleReturnService } from "@/services/wholesale-return.service";

const itemSchema = z.object({
  originalOrderItemId: z.number().int().positive(),
  quantityRequested: z.number().int().positive(),
});

const createSchema = z.object({
  orderId: z.number().int().positive(),
  reason: z.string().trim().min(3, "سبب الإرجاع مطلوب").max(500),
  expectedRefundAmount: z.number().nonnegative().optional().nullable(),
  items: z.array(itemSchema).min(1, "بند واحد على الأقل").max(50),
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
      "POST:/api/wholesale/returns",
      parsed.data,
      async () => {
        const returnId = await prisma.$transaction(async (tx) => {
          return await WholesaleReturnService.create(
            tx,
            auth.current.user.id,
            {
              orderId: parsed.data.orderId,
              reason: parsed.data.reason,
              expectedRefundAmount:
                parsed.data.expectedRefundAmount ?? null,
              items: parsed.data.items,
            }
          );
        });
        return { data: { returnId }, status: 201 };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/returns");
  }
}