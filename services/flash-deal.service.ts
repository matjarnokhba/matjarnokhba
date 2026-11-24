// منطق العروض المحدودة: حساب السعر وحجز الكمية وتطبيقها على نتائج المتجر.
// لا يستورد prisma عمداً (يُمرَّر كمعامل) كي تبقى الاختبارات بلا قاعدة بيانات.

export type ActiveDeal = {
  itemId: number;
  saleId: number;
  productId: number;
  dealPrice: number;
  basePrice: number; // سعر الخيار الافتراضي الأصلي
  remaining: number | null; // null = بلا حدّ
  endsAt: Date;
  sellerSharePct: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * سعر الخيار تحت العرض: نفس نسبة (سعر العرض / السعر الافتراضي) على كل الخيارات.
 * لا يرفع السعر أبداً، وأي مدخل غير صالح يُرجع السعر كما هو.
 */
export function applyDealPrice(variantPrice: number, basePrice: number, dealPrice: number | null): number {
  if (!dealPrice || !(dealPrice > 0) || !(basePrice > 0) || dealPrice >= basePrice) return variantPrice;
  const p = round2((variantPrice * dealPrice) / basePrice);
  return p > 0 && p < variantPrice ? p : variantPrice;
}

export const FlashDealService = {
  /** العروض الفعّالة الآن (واحد لكل منتج). عند أي خطأ ترجع فارغة ولا تكسر المتجر. */
  async getActiveDeals(db: any, productIds: number[], now: Date = new Date()): Promise<Map<number, ActiveDeal>> {
    const out = new Map<number, ActiveDeal>();
    if (productIds.length === 0) return out;
    try {
      const items: any[] = await db.flashSaleItem.findMany({
        where: {
          productId: { in: productIds },
          dealPrice: { not: null },
          status: "APPROVED",
          sale: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
        },
        select: {
          id: true,
          saleId: true,
          productId: true,
          dealPrice: true,
          quantityLimit: true,
          soldCount: true,
          sellerSharePct: true,
          sale: { select: { endsAt: true } },
        },
        orderBy: [{ sale: { endsAt: "asc" } }, { id: "asc" }],
      });
      if (items.length === 0) return out;

      const ids = Array.from(new Set(items.map((i) => i.productId)));
      const defaults: any[] = await db.productVariant.findMany({
        where: { productId: { in: ids }, isDefault: true },
        select: { productId: true, price: true },
      });
      const base = new Map<number, number>(defaults.map((v) => [v.productId, Number(v.price)]));

      for (const it of items) {
        if (out.has(it.productId)) continue;
        const dealPrice = Number(it.dealPrice);
        const basePrice = base.get(it.productId);
        if (!(dealPrice > 0) || !basePrice || dealPrice >= basePrice) continue;
        const remaining = it.quantityLimit == null ? null : it.quantityLimit - it.soldCount;
        if (remaining !== null && remaining <= 0) continue; // نفدت الحصة: يعود السعر العادي
        out.set(it.productId, {
          itemId: it.id,
          saleId: it.saleId,
          productId: it.productId,
          dealPrice,
          basePrice,
          remaining,
          sellerSharePct: Math.min(100, Math.max(0, Number(it.sellerSharePct ?? 0))),
          endsAt: it.sale.endsAt,
        });
      }
      return out;
    } catch (err) {
      console.error("[flash-deal] getActiveDeals failed", err);
      return new Map();
    }
  },

  /** يحجز كمية من حصة العرض بأمر واحد ذرّي (يفشل إن تجاوز الحدّ). داخل معاملة الطلب. */
  async reserve(tx: any, itemId: number, qty: number): Promise<boolean> {
    const n = await tx.$executeRaw`UPDATE "FlashSaleItem" SET "soldCount" = "soldCount" + ${qty} WHERE "id" = ${itemId} AND ("quantityLimit" IS NULL OR "soldCount" + ${qty} <= "quantityLimit")`;
    return n === 1;
  },

  /** يعيد كمية إلى حصة العرض (إلغاء/رفض/مرتجع قبل التسليم). لا ينزل عن صفر. */
  async releaseQuota(tx: any, itemId: number, qty: number): Promise<void> {
    if (!(qty > 0)) return;
    await tx.$executeRaw`UPDATE "FlashSaleItem" SET "soldCount" = GREATEST("soldCount" - ${qty}, 0) WHERE "id" = ${itemId}`;
  },

  /** عند إلغاء/رفض الطلب: يعيد حصة بنود العرض غير المسوّاة لهذا المتغير ويعلّم سجلها معكوساً. */
  async releaseForOrderVariant(tx: any, orderId: number, variantId: number): Promise<void> {
    const lines: any[] =
      (await tx.flashSaleOrderLine?.findMany({
        where: { reversedAt: null, settledAt: null, orderItem: { orderId, variantId } },
        select: { id: true, flashSaleItemId: true, quantity: true },
      })) ?? [];
    for (const l of lines) {
      await FlashDealService.releaseQuota(tx, l.flashSaleItemId, l.quantity);
      await tx.flashSaleOrderLine.update({ where: { id: l.id }, data: { reversedAt: new Date() } });
    }
  },

  /** شحنة أُرجعت/رُفضت قبل التسليم: يعيد الحصة بكمية بنود الشحنة ويعكس السجل إن اكتملت كمية البند. */
  async releaseForShipmentItems(
    tx: any,
    items: { orderItemId: number; quantity: number }[]
  ): Promise<void> {
    if (items.length === 0) return;
    const lines: any[] =
      (await tx.flashSaleOrderLine?.findMany({
        where: {
          orderItemId: { in: items.map((i) => i.orderItemId) },
          reversedAt: null,
          settledAt: null,
        },
        select: { id: true, orderItemId: true, flashSaleItemId: true, quantity: true },
      })) ?? [];
    const qtyByItem = new Map<number, number>();
    for (const i of items) qtyByItem.set(i.orderItemId, (qtyByItem.get(i.orderItemId) ?? 0) + i.quantity);
    for (const l of lines) {
      const q = Math.min(qtyByItem.get(l.orderItemId) ?? 0, l.quantity);
      if (q <= 0) continue;
      await FlashDealService.releaseQuota(tx, l.flashSaleItemId, q);
      if (q >= l.quantity) {
        await tx.flashSaleOrderLine.update({ where: { id: l.id }, data: { reversedAt: new Date() } });
      }
    }
  },
};

const isList = (x: any) =>
  !!x && typeof x === "object" && typeof x.id === "number" && typeof x.price === "number" && Array.isArray(x.images);
const isDetail = (x: any) =>
  !!x &&
  typeof x === "object" &&
  typeof x.id === "number" &&
  Array.isArray(x.variants) &&
  x.variants.length > 0 &&
  typeof x.variants[0]?.price === "number";

/** يطبّق أسعار العروض على منتج واحد أو قائمة منتجات (idempotent). */
export async function decorateWithDeals(db: any, result: any): Promise<any> {
  if (!result || typeof result !== "object") return result;
  const list: any[] | null = Array.isArray(result) ? result : null;
  const targets = list ?? [result];
  const ids = targets.filter((t) => (isList(t) || isDetail(t)) && !t.flashDeal).map((t) => t.id as number);
  if (ids.length === 0) return result;

  const deals = await FlashDealService.getActiveDeals(db, ids);
  if (deals.size === 0) return result;

  const apply = (t: any) => {
    if (!t || t.flashDeal) return t;
    const deal = deals.get(t.id);
    if (!deal) return t;
    if (isDetail(t)) {
      return {
        ...t,
        flashDeal: true,
        variants: t.variants.map((v: any) => {
          const p = applyDealPrice(v.price, deal.basePrice, deal.dealPrice);
          return p < v.price ? { ...v, price: p, oldPrice: v.price } : v;
        }),
      };
    }
    if (isList(t)) {
      const p = applyDealPrice(t.price, deal.basePrice, deal.dealPrice);
      return p < t.price ? { ...t, price: p, oldPrice: t.price, flashDeal: true } : t;
    }
    return t;
  };
  return list ? list.map(apply) : apply(result);
}

/** يلفّ خدمة كاملة: كل دالة ترجع نتيجتها بعد تطبيق العروض. */
export function withFlashDeals<T extends Record<string, any>>(svc: T, db: any): T {
  const out: Record<string, any> = {};
  for (const key of Object.keys(svc)) {
    const fn = svc[key];
    out[key] =
      typeof fn === "function"
        ? async (...args: any[]) => decorateWithDeals(db, await fn.apply(svc, args))
        : fn;
  }
  return out as T;
}

/** تقسيم تكلفة الخصم بين التاجر والمنصة لبند واحد (قيم بالدرهم، تقريب لرقمين). */
export function computeSubsidy(listUnitPrice: number, dealUnitPrice: number, quantity: number, sellerSharePct: number) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const pct = Math.min(100, Math.max(0, Number(sellerSharePct) || 0));
  const discount = r2(Math.max(0, listUnitPrice - dealUnitPrice) * quantity);
  const sellerPart = r2((discount * pct) / 100);
  const platformSubsidy = r2(discount - sellerPart);
  return { discount, sellerPart, platformSubsidy };
}