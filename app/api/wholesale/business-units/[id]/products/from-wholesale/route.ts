import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  parseJson,
  handleError,
  withIdempotency,
  fail,
  numericParam,
} from "@/lib/api";
import { MerchantProductService } from "@/services/merchant-product.service";

const fromWholesaleSchema = z.object({
  masterId: z.number().int().positive(),
  sourceWholesaleOrderId: z.number().int().positive(),
  retailPrice: z.number().nonnegative().max(99999999.99),
  variantOverrides: z
    .array(
      z.object({
        masterVariantId: z.number().int().positive(),
        sku: z.string().trim().min(1).max(100).optional(),
        barcode: z.string().trim().max(100).optional().nullable(),
        price: z.number().nonnegative().max(99999999.99).optional(),
      })
    )
    .optional(),
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

    const parsed = await parseJson(request, fromWholesaleSchema);
    if (!parsed.ok) return parsed.response;

    // Validate order ownership + DELIVERED + contains masterId
    const order = await prisma.wholesaleOrder.findFirst({
      where: {
        id: parsed.data.sourceWholesaleOrderId,
        buyerBusinessUnitId: businessUnitId,
        status: "DELIVERED",
      },
      include: {
        items: {
          select: { offer: { select: { masterId: true } } },
        },
      },
    });
    if (!order) {
      return fail("الطلب غير موجود أو لم يُسلَّم بعد", 404);
    }
    const hasMaster = order.items.some(
      (i: any) => i.offer?.masterId === parsed.data.masterId
    );
    if (!hasMaster) {
      return fail("هذا المنتج ليس ضمن بنود الطلب", 400);
    }

    return await withIdempotency(
      request,
      auth.current.user.id,
      `POST:/api/wholesale/business-units/${businessUnitId}/products/from-wholesale`,
      parsed.data,
      async () => {
        const productId = await MerchantProductService.createFromWholesale(
          auth.current.user.id,
          { businessUnitId, ...parsed.data }
        );
        return { data: { productId }, status: 201 };
      }
    );
  } catch (err) {
    return handleError(
      err,
      "POST /wholesale/business-units/[id]/products/from-wholesale"
    );
  }
}