import { prisma } from "@/lib/prisma";
import { requireAdmin, parseJson, ok, fail, handleError } from "@/lib/api/handler";
import { itemsSchema } from "@/lib/flash-sale-schema";

// يستبدل قائمة منتجات الحملة بالقائمة المرسلة (بنفس الترتيب)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const { id: raw } = await params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, itemsSchema);
    if (!parsed.ok) return parsed.response;
    const ids = Array.from(new Set(parsed.data.productIds));

    const sale = await prisma.flashSale.findUnique({ where: { id }, select: { id: true } });
    if (!sale) return fail("الحملة غير موجودة", 404);

    if (ids.length > 0) {
      const found = await prisma.product.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true },
      });
      if (found.length !== ids.length) return fail("بعض المنتجات غير موجودة", 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.flashSaleItem.deleteMany({ where: { saleId: id, productId: { notIn: ids } } });
      for (let i = 0; i < ids.length; i++) {
        await tx.flashSaleItem.upsert({
          where: { saleId_productId: { saleId: id, productId: ids[i] } },
          update: { order: i },
          create: { saleId: id, productId: ids[i], order: i },
        });
      }
    });
    return ok({});
  } catch (err) {
    return handleError(err, "admin-flash-items");
  }
}