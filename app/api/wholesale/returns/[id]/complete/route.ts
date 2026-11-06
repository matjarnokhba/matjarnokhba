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
      `POST:/api/wholesale/returns/${returnId}/complete`,
      { returnId },
      async () => {
        const result = await prisma.$transaction(
          async (tx) => {
            return await WholesaleReturnService.complete(
              tx,
              auth.current.user.id,
              returnId
            );
          },
          { timeout: 30000 }
        );
        return { data: result };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/returns/[id]/complete");
  }
}