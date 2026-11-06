import {
  requireAuth,
  handleError,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { WholesaleOrderService } from "@/services/wholesale-order.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const groupId = numericParam(id);
    if (!groupId) return fail("معرف غير صحيح", 400);

    const group = await WholesaleOrderService.getGroup(
      auth.current.user.id,
      groupId
    );
    return ok({ group });
  } catch (err) {
    return handleError(err, "GET /wholesale/order-groups/[id]");
  }
}