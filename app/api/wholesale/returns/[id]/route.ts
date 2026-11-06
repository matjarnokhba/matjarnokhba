import {
  requireAuth,
  handleError,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { WholesaleReturnService } from "@/services/wholesale-return.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const returnId = numericParam(id);
    if (!returnId) return fail("معرف غير صحيح", 400);

    const returnOrder = await WholesaleReturnService.get(
      auth.current.user.id,
      returnId
    );
    return ok({ returnOrder });
  } catch (err) {
    return handleError(err, "GET /wholesale/returns/[id]");
  }
}