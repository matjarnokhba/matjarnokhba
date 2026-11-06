import { z } from "zod";
import {
  requireAuth,
  parseJson,
  handleError,
  withIdempotency,
  fail,
  numericParam,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { WholesaleReturnService } from "@/services/wholesale-return.service";

const inspectSchema = z.object({
  items: z
    .array(
      z.object({
        returnOrderItemId: z.number().int().positive(),
        condition: z.enum([
          "SELLABLE",
          "DAMAGED",
          "QUARANTINED",
          "REJECTED_RETURN",
        ]),
        quantityAccepted: z.number().int().nonnegative(),
      })
    )
    .min(1, "بند واحد على الأقل"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const returnId = numericParam(id);
    if (!returnId) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, inspectSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/wholesale/returns/${returnId}/inspect`,
      parsed.data,
      async () => {
        await prisma.$transaction(async (tx) => {
          await WholesaleReturnService.inspect(
            tx,
            auth.current.user.id,
            returnId,
            parsed.data.items
          );
        });
        return { data: { inspected: true } };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/returns/[id]/inspect");
  }
}