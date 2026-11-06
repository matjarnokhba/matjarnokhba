import {
  requireAdmin,
  handleError,
  withIdempotency,
  fail,
  numericParam,
} from "@/lib/api";
import { MasterProductService } from "@/services/master-product.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const masterId = numericParam(id);
    if (!masterId) return fail("معرف غير صحيح", 400);

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/admin/wholesale/master-products/${masterId}/approve`,
      { masterId },
      async () => {
        await MasterProductService.approve(auth.current.user.id, masterId);
        return { data: { approved: true } };
      }
    );
  } catch (err) {
    return handleError(err, "POST /admin/wholesale/master-products/[id]/approve");
  }
}