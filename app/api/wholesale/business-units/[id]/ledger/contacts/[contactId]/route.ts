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
import { LedgerContactService } from "@/services/ledger-contact.service";

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    contactType: z
      .enum(["PLATFORM_TRADER", "EXTERNAL", "EMPLOYEE", "SUPPLIER"])
      .optional(),
    phone: z.string().trim().max(30).optional().nullable(),
    email: z.string().trim().email().max(200).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "لا يوجد تغيير");

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id, contactId } = await params;
    const businessUnitId = numericParam(id);
    const cId = numericParam(contactId);
    if (!businessUnitId || !cId) return fail("معرف غير صحيح", 400);

    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("entryLimit");
    const limit = limitRaw ? parseInt(limitRaw, 10) : 100;

    const result = await LedgerContactService.get(
      auth.current.user.id,
      businessUnitId,
      cId,
      isNaN(limit) ? 100 : limit
    );

    return ok(result);
  } catch (err) {
    return handleError(
      err,
      "GET /wholesale/business-units/[id]/ledger/contacts/[contactId]"
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id, contactId } = await params;
    const businessUnitId = numericParam(id);
    const cId = numericParam(contactId);
    if (!businessUnitId || !cId) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, updateSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `PATCH:/api/wholesale/business-units/${businessUnitId}/ledger/contacts/${cId}`,
      parsed.data,
      async () => {
        await LedgerContactService.update(
          auth.current.user.id,
          businessUnitId,
          cId,
          parsed.data
        );
        return { data: { updated: true } };
      }
    );
  } catch (err) {
    return handleError(
      err,
      "PATCH /wholesale/business-units/[id]/ledger/contacts/[contactId]"
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id, contactId } = await params;
    const businessUnitId = numericParam(id);
    const cId = numericParam(contactId);
    if (!businessUnitId || !cId) return fail("معرف غير صحيح", 400);

    return await withIdempotency(
      request,
      auth.current.user.id,
      `DELETE:/api/wholesale/business-units/${businessUnitId}/ledger/contacts/${cId}`,
      { contactId: cId },
      async () => {
        await LedgerContactService.softDelete(
          auth.current.user.id,
          businessUnitId,
          cId
        );
        return { data: { deleted: true } };
      }
    );
  } catch (err) {
    return handleError(
      err,
      "DELETE /wholesale/business-units/[id]/ledger/contacts/[contactId]"
    );
  }
}