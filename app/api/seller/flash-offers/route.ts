import { prisma } from "@/lib/prisma";
import { requireSellerOwner } from "@/lib/seller-guards";
import { z } from "zod";
import { ok, fail, parseJson, handleError } from "@/lib/api/handler";
import { NotificationService } from "@/services/notification.service";

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

const proposeSchema = z.object({
  saleId: z.number().int().positive(),
  productId: z.number().int().positive(),
  dealPrice: z.number().positive(),
  quantityLimit: z.number().int().min(1).max(100000),
});

// التاجر يقترح عرضاً على منتجه: يتحمل كامل الخصم، ويحتاج اعتماد الإدارة
export async function POST(request: Request) {
  try {
    const auth = await requireSellerOwner();
    if (!auth.ok) return auth.response;
    const seller = auth.current.user.seller!;
    if (seller.status === "SUSPENDED" || seller.status === "CLOSED") return fail("متجرك معطّل", 403);

    const parsed = await parseJson(request, proposeSchema);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;

    const sale = await prisma.flashSale.findUnique({
      where: { id: d.saleId },
      select: { id: true, title: true, isActive: true, endsAt: true },
    });
    if (!sale || !sale.isActive || sale.endsAt <= new Date()) {
      return fail("هذه الحملة غير متاحة للاقتراح", 400);
    }
    const product = await prisma.product.findFirst({
      where: { id: d.productId, sellerId: seller.id, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!product) return fail("المنتج غير موجود في متجرك", 404);

    const def = await prisma.productVariant.findFirst({
      where: { productId: product.id, isDefault: true },
      select: { price: true },
    });
    const base = def ? Number(def.price) : 0;
    if (!base) return fail("المنتج بلا سعر افتراضي", 400);
    if (d.dealPrice >= base) return fail(`سعر العرض يجب أن يكون أقل من سعر المنتج (${base})`, 400);

    const pending = await prisma.flashSaleItem.count({
      where: { product: { sellerId: seller.id }, source: "SELLER", status: "PENDING_ADMIN" },
    });
    if (pending >= 20) return fail("لديك طلبات كثيرة بانتظار الإدارة، انتظر الردّ عليها", 429);

    const existing = await prisma.flashSaleItem.findUnique({
      where: { saleId_productId: { saleId: sale.id, productId: product.id } },
      select: { id: true, source: true, status: true },
    });
    let itemId: number;
    if (existing) {
      if (existing.source !== "SELLER" || !["REJECTED", "WITHDRAWN"].includes(existing.status)) {
        return fail("هذا المنتج موجود أصلاً في الحملة", 409);
      }
      await prisma.flashSaleItem.update({
        where: { id: existing.id },
        data: {
          dealPrice: d.dealPrice,
          quantityLimit: d.quantityLimit,
          sellerSharePct: 100,
          status: "PENDING_ADMIN",
          respondedAt: null,
          respondedById: null,
          responseNote: null,
          version: { increment: 1 },
        },
      });
      itemId = existing.id;
    } else {
      const created = await prisma.flashSaleItem.create({
        data: {
          saleId: sale.id,
          productId: product.id,
          dealPrice: d.dealPrice,
          quantityLimit: d.quantityLimit,
          sellerSharePct: 100,
          source: "SELLER",
          status: "PENDING_ADMIN",
          order: 900,
        },
        select: { id: true },
      });
      itemId = created.id;
    }

    try {
      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, deletedAt: null },
        select: { id: true },
      });
      for (const a of admins) {
        await NotificationService.create({
          userId: a.id,
          type: "FLASH_OFFER_REQUESTED",
          title: "🔥 تاجر يقترح عرضاً محدوداً",
          message: `اقترح «${seller.storeName}» عرض «${product.name}» بسعر ${d.dealPrice} د.م (الكمية ${d.quantityLimit}) ضمن «${sale.title}». يتحمل التاجر كامل الخصم.`,
          link: "/admin/flash-sales/requests",
          category: "FLASH",
          severity: "INFO",
          metadata: { itemId, saleId: sale.id, productId: product.id },
        });
      }
    } catch (e) {
      console.error("flash propose admin notify failed", e);
    }
    return ok({ id: itemId }, 201);
  } catch (err) {
    return handleError(err, "seller-flash-propose");
  }
}