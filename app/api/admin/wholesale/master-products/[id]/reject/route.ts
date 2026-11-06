import { z } from "zod";
import {
  requireAdmin,
  parseJson,
  handleError,
  withIdempotency,
  fail,
  numericParam,
} from "@/lib/api";
import { MasterProductService } from "@/services/master-product.service";

const rejectSchema = z.object({
  reason: z.string().trim().min(3, "سبب الرفض مطلوب (3 أحرف على الأقل)").max(500),
});

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

    const parsed = await parseJson(request, rejectSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/admin/wholesale/master-products/${masterId}/reject`,
      parsed.data,
      async () => {
        await MasterProductService.reject(
          auth.current.user.id,
          masterId,
          parsed.data.reason
        );
        return { data: { rejected: true } };
      }
    );
  } catch (err) {
    return handleError(err, "POST /admin/wholesale/master-products/[id]/reject");
  }
}