import { z } from "zod";
import {
  requireAuth,
  parseJson,
  handleError,
  withIdempotency,
  fail,
  numericParam,
} from "@/lib/api";
import { LedgerContactService } from "@/services/ledger-contact.service";

const createEntrySchema = z.object({
  type: z.enum(["GAVE", "TOOK", "SETTLEMENT"]),
  amount: z.number(),
  description: z.string().trim().min(3, "الوصف مطلوب").max(500),
  entryDate: z
    .string()
    .datetime()
    .optional()
    .transform((s) => (s ? new Date(s) : undefined)),
  referenceType: z.string().trim().max(50).optional().nullable(),
  referenceId: z.number().int().positive().optional().nullable(),
  attachmentUrl: z.string().url().max(500).optional().nullable(),
});

export async function POST(
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

    const parsed = await parseJson(request, createEntrySchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/wholesale/business-units/${businessUnitId}/ledger/contacts/${cId}/entries`,
      parsed.data,
      async () => {
        const result = await LedgerContactService.addEntry(
          auth.current.user.id,
          businessUnitId,
          cId,
          {
            type: parsed.data.type,
            amount: parsed.data.amount,
            description: parsed.data.description,
            entryDate: parsed.data.entryDate,
            referenceType: parsed.data.referenceType,
            referenceId: parsed.data.referenceId,
            attachmentUrl: parsed.data.attachmentUrl,
          }
        );
        return { data: result, status: 201 };
      }
    );
  } catch (err) {
    return handleError(
      err,
      "POST /wholesale/business-units/[id]/ledger/contacts/[contactId]/entries"
    );
  }
}