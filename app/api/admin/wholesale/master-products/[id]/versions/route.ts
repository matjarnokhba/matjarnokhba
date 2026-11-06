import {
  requireAdmin,
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
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const masterId = numericParam(id);
    if (!masterId) return fail("معرف غير صحيح", 400);

    const versions = await MasterProductService.getVersions(masterId);
    return ok({ versions });
  } catch (err) {
    return handleError(err, "GET /admin/wholesale/master-products/[id]/versions");
  }
}