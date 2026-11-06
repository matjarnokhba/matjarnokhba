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
import { MerchantProductService } from "@/services/merchant-product.service";

const attrSchema = z.object({
  name: z.string().trim().min(1).max(50),
  value: z.string().trim().min(1).max(100),
});

const variantSchema = z.object({
  masterVariantId: z.number().int().positive().optional().nullable(),
  displayAttributes: z.array(attrSchema).max(20).default([]),
  baseUnitPrice: z.number().nonnegative().max(99999999.99),
  sku: z.string().trim().min(1, "SKU مطلوب").max(100),
  barcode: z.string().trim().max(100).optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const sellingUnitSchema = z.object({
  name: z.string().trim().min(1).max(50),
  conversionFactor: z.number().int().positive(),
  price: z.number().nonnegative().max(99999999.99),
  isActive: z.boolean().optional(),
});

const createSchema = z.object({
  masterId: z.number().int().positive(),
  displayName: z.string().trim().min(2, "اسم العرض مطلوب").max(200),
  displayImages: z.array(z.string().url()).min(1, "صورة واحدة على الأقل").max(10),
  displayDescription: z.string().trim().max(2000).optional().nullable(),
  retailPrice: z.number().nonnegative().max(99999999.99),
  variants: z.array(variantSchema).min(1, "variant واحد على الأقل").max(50),
  sellingUnits: z.array(sellingUnitSchema).min(1, "وحدة بيع واحدة على الأقل").max(10),
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
      `POST:/api/wholesale/business-units/${businessUnitId}/products`,
      parsed.data,
      async () => {
        const productId = await MerchantProductService.create(
          auth.current.user.id,
          { businessUnitId, ...parsed.data }
        );
        return { data: { productId }, status: 201 };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/business-units/[id]/products");
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
      ? (statusRaw as "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED")
      : undefined;
    const search = url.searchParams.get("search") || undefined;
    const pageRaw = url.searchParams.get("page");
    const pageSizeRaw = url.searchParams.get("pageSize");

    const result = await MerchantProductService.list(
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
    return handleError(err, "GET /wholesale/business-units/[id]/products");
  }
}