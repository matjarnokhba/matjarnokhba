import { describe, it, expect, vi } from "vitest";
import { applyDealPrice, FlashDealService, decorateWithDeals, withFlashDeals } from "./flash-deal.service";

const endsAt = new Date("2030-01-01T00:00:00Z");
const item = (o: any = {}) => ({
  id: 1,
  saleId: 1,
  productId: 10,
  dealPrice: 80,
  quantityLimit: null,
  soldCount: 0,
  sale: { endsAt },
  ...o,
});
const baseVariants = [{ productId: 10, price: 100 }];
const fakeDb = (items: any[], variants: any[] = baseVariants) => ({
  flashSaleItem: { findMany: async () => items },
  productVariant: { findMany: async () => variants },
});

describe("applyDealPrice", () => {
  it("منتج بخيار واحد: يعطي سعر العرض نفسه", () => {
    expect(applyDealPrice(100, 100, 80)).toBe(80);
  });
  it("يطبّق نفس النسبة على بقية الخيارات", () => {
    expect(applyDealPrice(150, 100, 80)).toBe(120);
  });
  it("يقرّب إلى خانتين عشريتين", () => {
    expect(applyDealPrice(33.33, 100, 79)).toBe(26.33);
  });
  it("لا يرفع السعر أبداً ويتجاهل المدخلات غير الصالحة", () => {
    expect(applyDealPrice(100, 100, 100)).toBe(100);
    expect(applyDealPrice(100, 100, 120)).toBe(100);
    expect(applyDealPrice(100, 100, null)).toBe(100);
    expect(applyDealPrice(100, 100, 0)).toBe(100);
    expect(applyDealPrice(100, 0, 50)).toBe(100);
  });
});

describe("FlashDealService.getActiveDeals", () => {
  it("يرجع العرض مع السعر الأساسي والكمية المتبقية", async () => {
    const m = await FlashDealService.getActiveDeals(fakeDb([item({ quantityLimit: 10, soldCount: 4 })]), [10]);
    expect(m.get(10)).toMatchObject({ dealPrice: 80, basePrice: 100, remaining: 6, itemId: 1 });
  });
  it("القيمة العشرية القادمة كنص تُقرأ صحيحة", async () => {
    const m = await FlashDealService.getActiveDeals(fakeDb([item({ dealPrice: "80.00" })]), [10]);
    expect(m.get(10)?.dealPrice).toBe(80);
  });
  it("يتجاهل العرض بلا سعر أو بسعر غير أقل من الأصل", async () => {
    expect((await FlashDealService.getActiveDeals(fakeDb([item({ dealPrice: null })]), [10])).size).toBe(0);
    expect((await FlashDealService.getActiveDeals(fakeDb([item({ dealPrice: 100 })]), [10])).size).toBe(0);
  });
  it("يتجاهل العرض عند نفاد الحصة", async () => {
    expect((await FlashDealService.getActiveDeals(fakeDb([item({ quantityLimit: 5, soldCount: 5 })]), [10])).size).toBe(0);
  });
  it("عرض واحد لكل منتج (الأقرب انتهاءً أولاً)", async () => {
    const m = await FlashDealService.getActiveDeals(fakeDb([item({ id: 1 }), item({ id: 2, dealPrice: 50 })]), [10]);
    expect(m.get(10)?.itemId).toBe(1);
  });
  it("عند خطأ قاعدة البيانات يرجع فارغاً ولا يرمي", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = { flashSaleItem: { findMany: async () => { throw new Error("boom"); } }, productVariant: { findMany: async () => [] } };
    expect((await FlashDealService.getActiveDeals(bad, [10])).size).toBe(0);
    spy.mockRestore();
  });
});

describe("FlashDealService.reserve", () => {
  it("true عند نجاح الحجز، false عند تجاوز الحصة", async () => {
    expect(await FlashDealService.reserve({ $executeRaw: async () => 1 }, 1, 2)).toBe(true);
    expect(await FlashDealService.reserve({ $executeRaw: async () => 0 }, 1, 2)).toBe(false);
  });
});

describe("decorateWithDeals", () => {
  it("قائمة منتجات: يعدّل المنتج ذا العرض فقط", async () => {
    const list = [
      { id: 10, price: 100, images: [] },
      { id: 11, price: 50, images: [] },
    ];
    const out = await decorateWithDeals(fakeDb([item()]), list);
    expect(out[0]).toMatchObject({ price: 80, oldPrice: 100, flashDeal: true });
    expect(out[1].price).toBe(50);
  });
  it("لا يطبّق العرض مرتين (idempotent)", async () => {
    const once = await decorateWithDeals(fakeDb([item()]), [{ id: 10, price: 100, images: [] }]);
    const twice = await decorateWithDeals(fakeDb([item()]), once);
    expect(twice[0].price).toBe(80);
    expect(twice[0].oldPrice).toBe(100);
  });
  it("تفاصيل المنتج: يطبّق النسبة على كل الخيارات", async () => {
    const detail = {
      id: 10,
      variants: [
        { id: 1, price: 100, oldPrice: null },
        { id: 2, price: 150, oldPrice: null },
      ],
    };
    const out = await decorateWithDeals(fakeDb([item()]), detail);
    expect(out.variants[0]).toMatchObject({ price: 80, oldPrice: 100 });
    expect(out.variants[1]).toMatchObject({ price: 120, oldPrice: 150 });
  });
  it("يمرّر القيم الفارغة وغير المنتجات كما هي", async () => {
    expect(await decorateWithDeals(fakeDb([]), null)).toBeNull();
    expect(await decorateWithDeals(fakeDb([item()]), { foo: 1 })).toEqual({ foo: 1 });
  });
});

describe("withFlashDeals", () => {
  it("يلفّ الدوال ويترك غيرها", async () => {
    const svc = {
      label: "x",
      async getAll() {
        return [{ id: 10, price: 100, images: [] }];
      },
    };
    const wrapped = withFlashDeals(svc, fakeDb([item()]));
    expect((await wrapped.getAll())[0].price).toBe(80);
    expect(wrapped.label).toBe("x");
  });
});