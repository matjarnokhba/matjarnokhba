import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api/handler";
import { ProductService } from "@/services/product.service";

export const dynamic = "force-dynamic";

// الحملة الفعّالة الآن + منتجاتها (بنفس شكل منتجات المتجر)
export async function GET() {
  try {
    const now = new Date();
    const sale = await prisma.flashSale.findFirst({
      where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { endsAt: "asc" },
      include: { items: { orderBy: { order: "asc" } } },
    });
    if (!sale || sale.items.length === 0) return ok({ sale: null, products: [] });

    const all: any[] = await ProductService.getAll();
    const byId = new Map<number, any>(all.map((p) => [p.id, p]));
    const products = sale.items
      .map((it) => {
        const p = byId.get(it.productId);
        return p ? { ...p, quantityLimit: it.quantityLimit, soldCount: it.soldCount } : null;
      })
      .filter(Boolean);

    if (products.length === 0) return ok({ sale: null, products: [] });

    return ok({
      sale: {
        id: sale.id,
        title: sale.title,
        subtitle: sale.subtitle,
        endsAt: sale.endsAt.toISOString(),
        showCountdown: sale.showCountdown,
        showProgress: sale.showProgress,
      },
      products,
    });
  } catch (err) {
    return handleError(err, "flash-active-get");
  }
}