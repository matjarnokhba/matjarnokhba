import { z } from "zod";
import {
  requireAuth,
  parseJson,
  handleError,
  withIdempotency,
  ok,
} from "@/lib/api";
import { MasterProductService } from "@/services/master-product.service";

const attrSchema = z.object({
  name: z.string().trim().min(1).max(50),
  value: z.string().trim().min(1).max(100),
});

const variantSchema = z.object({
  sku: z.string().trim().max(100).optional().nullable(),
  barcode: z.string().trim().max(100).optional().nullable(),
  qrCode: z.string().trim().max(200).optional().nullable(),
  attributes: z.array(attrSchema).max(20).default([]),
  isDefault: z.boolean().optional(),
});

const submitSchema = z.object({
  name: z.string().trim().min(2, "اسم المنتج مطلوب").max(200),
  brand: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  categoryId: z.number().int().positive(),
  images: z.array(z.string().url()).min(1, "صورة واحدة على الأقل").max(10),
  barcode: z.string().trim().max(100).optional().nullable(),
  qrCode: z.string().trim().max(200).optional().nullable(),
  variants: z.array(variantSchema).min(1, "variant واحد على الأقل").max(20),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const parsed = await parseJson(request, submitSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      "POST:/api/wholesale/master-products",
      parsed.data,
      async () => {
        const masterId = await MasterProductService.submit(
          auth.current.user.id,
          parsed.data
        );
        return { data: { masterId }, status: 201 };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/master-products");
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const statusRaw = url.searchParams.get("status");
    const status = statusRaw
      ? (statusRaw as "PENDING_REVIEW" | "ACTIVE" | "SUSPENDED" | "ARCHIVED")
      : undefined;
    const categoryIdRaw = url.searchParams.get("categoryId");
    const categoryId = categoryIdRaw ? parseInt(categoryIdRaw, 10) : undefined;
    const search = url.searchParams.get("search") || undefined;
    const pageRaw = url.searchParams.get("page");
    const pageSizeRaw = url.searchParams.get("pageSize");

    const result = await MasterProductService.list({
      status,
      categoryId: categoryId && !isNaN(categoryId) ? categoryId : undefined,
      search,
      createdByUserId: auth.current.user.id,
      page: pageRaw ? parseInt(pageRaw, 10) : 1,
      pageSize: pageSizeRaw ? parseInt(pageSizeRaw, 10) : 30,
    });

    return ok(result);
  } catch (err) {
    return handleError(err, "GET /wholesale/master-products");
  }
}