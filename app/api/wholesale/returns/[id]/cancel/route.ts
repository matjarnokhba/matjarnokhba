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

const cancelSchema = z.object({
  reason: z.string().trim().min(3, "سبب الإلغاء مطلوب").max(500),
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

    const parsed = await parseJson(request, cancelSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/wholesale/returns/${returnId}/cancel`,
      parsed.data,
      async () => {
        await prisma.$transaction(async (tx) => {
          await WholesaleReturnService.cancel(
            tx,
            auth.current.user.id,
            returnId,
            parsed.data.reason
          );
        });
        return { data: { cancelled: true } };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/returns/[id]/cancel");
  }
}