import { z } from "zod";
import {
  requireAdmin,
  parseJson,
  handleError,
  withIdempotency,
  fail,
  numericParam,
} from "@/lib/api";
import { BusinessUnitService } from "@/services/business-unit.service";

const verifySchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED"]),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const businessUnitId = numericParam(id);
    if (!businessUnitId) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, verifySchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/admin/wholesale/business-units/${businessUnitId}/verify`,
      parsed.data,
      async () => {
        await BusinessUnitService.verify(
          auth.current.user.id,
          businessUnitId,
          parsed.data.status
        );
        return { data: { verified: true, status: parsed.data.status } };
      }
    );
  } catch (err) {
    return handleError(
      err,
      "POST /admin/wholesale/business-units/[id]/verify"
    );
  }
}