import {
  requireAuth,
  handleError,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { MasterProductService } from "@/services/master-product.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const masterId = numericParam(id);
    if (!masterId) return fail("معرف غير صحيح", 400);

    const master = await MasterProductService.get(masterId);
    return ok({ master });
  } catch (err) {
    return handleError(err, "GET /wholesale/master-products/[id]");
  }
}