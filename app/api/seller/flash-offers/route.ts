import { prisma } from "@/lib/prisma";
import { requireSellerOwner } from "@/lib/seller-guards";
import { ok, handleError } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

// عروضي المحدودة: كل عروض منتجات التاجر (آخر 60 يوماً) مع تكلفتها عليه
export async function GET() {
  try {
    const auth = await requireSellerOwner();
    if (!auth.ok) return auth.response;
    const sellerId = auth.current.user.seller!.id;
    const since = new Date(Date.now() - 60 * 86400000);

    const items = await prisma.flashSaleItem.findMany({
      where: { product: { sellerId }, sale: { endsAt: { gte: since } } },
      orderBy: [{ sale: { startsAt: "desc" } }, { id: "desc" }],
      select: {
        id: true,
        version: true,
        status: true,
        source: true,
        sellerSharePct: true,
        dealPrice: true,
        quantityLimit: true,
        soldCount: true,
        responseNote: true,
        sale: { select: { id: true, title: true, startsAt: true, endsAt: true, isActive: true } },
        product: {
          select: { id: true, name: true, images: { select: { url: true }, take: 1 } },
        },
      },
    });

    const productIds = Array.from(new Set(items.map((i) => i.product.id)));
    const defaults = productIds.length
      ? await prisma.productVariant.findMany({
          where: { productId: { in: productIds }, isDefault: true },
          select: { productId: true, price: true },
        })
      : [];
    const base = new Map(defaults.map((v) => [v.productId, Number(v.price)]));

    const lines = items.length
      ? await prisma.flashSaleOrderLine.findMany({
          where: { sellerId, reversedAt: null, flashSaleItemId: { in: items.map((i) => i.id) } },
          select: {
            flashSaleItemId: true,
            quantity: true,
            listUnitPrice: true,
            dealUnitPrice: true,
            platformSubsidy: true,
          },
        })
      : [];
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const agg = new Map<number, { qty: number; borne: number; subsidy: number }>();
    for (const l of lines) {
      const discount = (Number(l.listUnitPrice) - Number(l.dealUnitPrice)) * l.quantity;
      const subsidy = Number(l.platformSubsidy);
      const cur = agg.get(l.flashSaleItemId) ?? { qty: 0, borne: 0, subsidy: 0 };
      cur.qty += l.quantity;
      cur.subsidy += subsidy;
      cur.borne += discount - subsidy;
      agg.set(l.flashSaleItemId, cur);
    }

    const offers = items.map((i) => {
      const a = agg.get(i.id) ?? { qty: 0, borne: 0, subsidy: 0 };
      return {
        id: i.id,
        version: i.version,
        status: i.status,
        source: i.source,
        sellerSharePct: Number(i.sellerSharePct),
        dealPrice: i.dealPrice == null ? null : Number(i.dealPrice),
        basePrice: base.get(i.product.id) ?? null,
        quantityLimit: i.quantityLimit,
        soldCount: i.soldCount,
        responseNote: i.responseNote,
        sale: i.sale,
        product: { id: i.product.id, name: i.product.name, image: i.product.images[0]?.url ?? null },
        soldQty: a.qty,
        sellerBorne: r2(a.borne),
        platformSubsidy: r2(a.subsidy),
      };
    });
    const summary = offers.reduce(
      (s, o) => ({
        soldQty: s.soldQty + o.soldQty,
        sellerBorne: r2(s.sellerBorne + o.sellerBorne),
        platformSubsidy: r2(s.platformSubsidy + o.platformSubsidy),
      }),
      { soldQty: 0, sellerBorne: 0, platformSubsidy: 0 }
    );
    return ok({ offers, summary });
  } catch (err) {
    return handleError(err, "seller-flash-offers");
  }
}