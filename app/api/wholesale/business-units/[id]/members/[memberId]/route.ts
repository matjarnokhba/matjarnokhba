import { z } from "zod";
import {
  requireAuth,
  parseJson,
  handleError,
  withIdempotency,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { BusinessUnitService } from "@/services/business-unit.service";

const updatePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id, memberId } = await params;
    const businessUnitId = numericParam(id);
    const mId = numericParam(memberId);
    if (!businessUnitId || !mId) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, updatePermissionsSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `PATCH:/api/wholesale/business-units/${businessUnitId}/members/${mId}`,
      parsed.data,
      async () => {
        await BusinessUnitService.updateMemberPermissions(
          auth.current.user.id,
          businessUnitId,
          mId,
          parsed.data.permissions
        );
        return { data: { updated: true } };
      }
    );
  } catch (err) {
    return handleError(
      err,
      "PATCH /wholesale/business-units/[id]/members/[memberId]"
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id, memberId } = await params;
    const businessUnitId = numericParam(id);
    const mId = numericParam(memberId);
    if (!businessUnitId || !mId) return fail("معرف غير صحيح", 400);

    return await withIdempotency(
      request,
      auth.current.user.id,
      `DELETE:/api/wholesale/business-units/${businessUnitId}/members/${mId}`,
      { businessUnitId, memberId: mId },
      async () => {
        await BusinessUnitService.removeMember(
          auth.current.user.id,
          businessUnitId,
          mId
        );
        return { data: { removed: true } };
      }
    );
  } catch (err) {
    return handleError(
      err,
      "DELETE /wholesale/business-units/[id]/members/[memberId]"
    );
  }
}