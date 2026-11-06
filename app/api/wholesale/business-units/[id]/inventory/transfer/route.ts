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
import { InventoryTransferService } from "@/services/inventory-transfer.service";

const transferSchema = z.object({
  merchantVariantId: z.number().int().positive(),
  fromAccountId: z.number().int().positive(),
  toAccountId: z.number().int().positive(),
  quantity: z.number().int().positive().max(100000),
  notes: z.string().trim().max(500).optional().nullable(),
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

    const parsed = await parseJson(request, transferSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/wholesale/business-units/${businessUnitId}/inventory/transfer`,
      parsed.data,
      async () => {
        const result = await InventoryTransferService.transfer(
          auth.current.user.id,
          {
            businessUnitId,
            ...parsed.data,
          }
        );
        return { data: result, status: 201 };
      }
    );
  } catch (err) {
    return handleError(
      err,
      "POST /wholesale/business-units/[id]/inventory/transfer"
    );
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
    const mvRaw = url.searchParams.get("merchantVariantId");
    const mvId = mvRaw ? parseInt(mvRaw, 10) : undefined;
    const pageRaw = url.searchParams.get("page");
    const pageSizeRaw = url.searchParams.get("pageSize");

    const result = await InventoryTransferService.list(
      auth.current.user.id,
      businessUnitId,
      {
        merchantVariantId: mvId && !isNaN(mvId) ? mvId : undefined,
        page: pageRaw ? parseInt(pageRaw, 10) : 1,
        pageSize: pageSizeRaw ? parseInt(pageSizeRaw, 10) : 30,
      }
    );

    return ok(result);
  } catch (err) {
    return handleError(
      err,
      "GET /wholesale/business-units/[id]/inventory/transfer"
    );
  }
}