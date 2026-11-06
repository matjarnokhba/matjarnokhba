import {
  requireAuth,
  handleError,
  withIdempotency,
  fail,
  numericParam,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { WholesaleReturnService } from "@/services/wholesale-return.service";

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

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/wholesale/returns/${returnId}/mark-sent`,
      { returnId },
      async () => {
        await prisma.$transaction(async (tx) => {
          await WholesaleReturnService.markSent(
            tx,
            auth.current.user.id,
            returnId
          );
        });
        return { data: { marked: true } };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/returns/[id]/mark-sent");
  }
}