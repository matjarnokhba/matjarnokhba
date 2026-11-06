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
import { WholesaleOfferService } from "@/services/wholesale-offer.service";

const tierSchema = z.object({
  minQty: z.number().int().positive(),
  maxQty: z.number().int().positive().optional().nullable(),
  unitPrice: z.number().positive().max(99999999.99),
});

const variantSchema = z.object({
  masterVariantId: z.number().int().positive(),
  tiers: z.array(tierSchema).min(1, "شريحة سعر واحدة على الأقل"),
});

const createSchema = z.object({
  masterId: z.number().int().positive(),
  wholesalePrice: z.number().positive().max(99999999.99),
  minOrderQty: z.number().int().positive(),
  maxOrderQty: z.number().int().positive().optional().nullable(),
  claimType: z.enum(["MANUFACTURER", "DISTRIBUTOR", "IMPORTER", "RESELLER"]),
  claimProofUrl: z.string().url().optional().nullable(),
  claimNotes: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  variants: z.array(variantSchema).min(1).max(50),
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
      `POST:/api/wholesale/business-units/${businessUnitId}/offers`,
      parsed.data,
      async () => {
        const offerId = await WholesaleOfferService.create(
          auth.current.user.id,
          businessUnitId,
          parsed.data
        );
        return { data: { offerId }, status: 201 };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/business-units/[id]/offers");
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
    const statusRaw = url.searchParams.get("status");
    const status = statusRaw
      ? (statusRaw as
          | "DRAFT"
          | "PENDING_REVIEW"
          | "ACTIVE"
          | "PAUSED"
          | "REJECTED"
          | "OUT_OF_STOCK"
          | "SUSPENDED"
          | "ARCHIVED")
      : undefined;
    const search = url.searchParams.get("search") || undefined;
    const pageRaw = url.searchParams.get("page");
    const pageSizeRaw = url.searchParams.get("pageSize");

    const result = await WholesaleOfferService.listByBusinessUnit(
      auth.current.user.id,
      businessUnitId,
      {
        status,
        search,
        page: pageRaw ? parseInt(pageRaw, 10) : 1,
        pageSize: pageSizeRaw ? parseInt(pageSizeRaw, 10) : 30,
      }
    );

    return ok(result);
  } catch (err) {
    return handleError(err, "GET /wholesale/business-units/[id]/offers");
  }
}