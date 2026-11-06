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

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    brand: z.string().trim().max(80).optional().nullable(),
    description: z.string().trim().max(2000).optional().nullable(),
    categoryId: z.number().int().positive().optional(),
    images: z.array(z.string().url()).min(1).max(10).optional(),
    barcode: z.string().trim().max(100).optional().nullable(),
    qrCode: z.string().trim().max(200).optional().nullable(),
    changeReason: z.string().trim().max(500).optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, "لا يوجد تغيير");

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const masterId = numericParam(id);
    if (!masterId) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, updateSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `PATCH:/api/admin/wholesale/master-products/${masterId}`,
      parsed.data,
      async () => {
        await MasterProductService.update(
          auth.current.user.id,
          masterId,
          parsed.data
        );
        return { data: { updated: true } };
      }
    );
  } catch (err) {
    return handleError(err, "PATCH /admin/wholesale/master-products/[id]");
  }
}