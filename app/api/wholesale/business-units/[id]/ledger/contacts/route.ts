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

const createSchema = z.object({
  name: z.string().trim().min(2, "اسم الطرف مطلوب").max(200),
  contactType: z
    .enum(["PLATFORM_TRADER", "EXTERNAL", "EMPLOYEE", "SUPPLIER"])
    .default("EXTERNAL"),
  linkedUserId: z.number().int().positive().optional().nullable(),
  linkedBUId: z.number().int().positive().optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  openingBalance: z.number().optional(),
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

    const parsed = await parseJson(request, createSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/wholesale/business-units/${businessUnitId}/ledger/contacts`,
      parsed.data,
      async () => {
        const contactId = await LedgerContactService.create(
          auth.current.user.id,
          businessUnitId,
          parsed.data
        );
        return { data: { contactId }, status: 201 };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/business-units/[id]/ledger/contacts");
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const businessUnitId = numericParam(id);
    if (!businessUnitId) return fail("معرف غير صحيح", 400);

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || undefined;
    const contactType = url.searchParams.get("contactType") || undefined;
    const hasBalanceRaw = url.searchParams.get("hasBalance");
    const hasBalance =
      hasBalanceRaw === "positive" ||
      hasBalanceRaw === "negative" ||
      hasBalanceRaw === "zero"
        ? hasBalanceRaw
        : undefined;
    const pageRaw = url.searchParams.get("page");
    const pageSizeRaw = url.searchParams.get("pageSize");

    const result = await LedgerContactService.list(
      auth.current.user.id,
      businessUnitId,
      {
        search,
        contactType,
        hasBalance,
        page: pageRaw ? parseInt(pageRaw, 10) : 1,
        pageSize: pageSizeRaw ? parseInt(pageSizeRaw, 10) : 30,
      }
    );

    return ok(result);
  } catch (err) {
    return handleError(err, "GET /wholesale/business-units/[id]/ledger/contacts");
  }
}