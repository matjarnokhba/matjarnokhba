import { z } from "zod";
import {
  requireAuth,
  parseJson,
  handleError,
  withIdempotency,
  fail,
  numericParam,
} from "@/lib/api";
import { BusinessUnitService } from "@/services/business-unit.service";

const addMemberSchema = z.object({
  userId: z.number().int().positive(),
  role: z.enum(["MANAGER", "STAFF"]),
  permissions: z.array(z.string()).default([]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const businessUnitId = numericParam(id);
    if (!businessUnitId) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, addMemberSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/wholesale/business-units/${businessUnitId}/members`,
      parsed.data,
      async () => {
        const memberId = await BusinessUnitService.addMember(
          auth.current.user.id,
          businessUnitId,
          parsed.data
        );
        return { data: { memberId }, status: 201 };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/business-units/[id]/members");
  }
}