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
          sale: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
        },
        select: {
          id: true,
          saleId: true,
          productId: true,
          dealPrice: true,
          quantityLimit: true,
          soldCount: true,
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