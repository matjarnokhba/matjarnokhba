import { prisma } from "@/lib/prisma";
import { requireAdmin, parseJson, ok, fail, handleError } from "@/lib/api/handler";
import { itemsSchema } from "@/lib/flash-sale-schema";

// يستبدل منتجات الحملة بالقائمة المرسلة (بنفس الترتيب) مع سعر العرض والكمية
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
    const rows = parsed.data.items;
    const ids = rows.map((r) => r.productId);
    if (new Set(ids).size !== ids.length) return fail("منتج مكرر في القائمة", 400);

    const sale = await prisma.flashSale.findUnique({ where: { id }, select: { id: true } });
    if (!sale) return fail("الحملة غير موجودة", 404);

    if (ids.length > 0) {
      const found = await prisma.product.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true },
      });
      if (found.length !== ids.length) return fail("بعض المنتجات غير موجودة", 400);
    }

    // سعر العرض يجب أن يكون أقل من سعر المنتج الحالي
    const priced = rows.filter((r) => r.dealPrice != null);
    if (priced.length > 0) {
      const defaults = await prisma.productVariant.findMany({
        where: { productId: { in: priced.map((r) => r.productId) }, isDefault: true },
        select: { productId: true, price: true },
      });
      const base = new Map(defaults.map((v) => [v.productId, Number(v.price)]));
      for (const r of priced) {
        const b = base.get(r.productId);
        if (!b) return fail(`المنتج #${r.productId} بلا سعر افتراضي`, 400);
        if ((r.dealPrice as number) >= b) {
          return fail(`سعر العرض للمنتج #${r.productId} يجب أن يكون أقل من سعره الحالي (${b})`, 400);
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.flashSaleItem.deleteMany({ where: { saleId: id, productId: { notIn: ids } } });
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const data = { order: i, dealPrice: r.dealPrice ?? null, quantityLimit: r.quantityLimit ?? null };
        await tx.flashSaleItem.upsert({
          where: { saleId_productId: { saleId: id, productId: r.productId } },
          update: data,
          create: { saleId: id, productId: r.productId, ...data },
        });
      }
    });
    return ok({});
  } catch (err) {
    return handleError(err, "admin-flash-items");
  }
}