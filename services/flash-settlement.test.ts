import { describe, it, expect, vi } from "vitest";
import { computeSubsidy, FlashDealService } from "./flash-deal.service";

describe("computeSubsidy", () => {
  it("المنصة تتحمل الكل عندما نسبة التاجر 0", () => {
    const r = computeSubsidy(100, 80, 3, 0);
    expect(r.discount).toBe(60);
    expect(r.sellerPart).toBe(0);
    expect(r.platformSubsidy).toBe(60);
  });
  it("التاجر يتحمل الكل عندما النسبة 100", () => {
    const r = computeSubsidy(100, 80, 3, 100);
    expect(r.sellerPart).toBe(60);
    expect(r.platformSubsidy).toBe(0);
  });
  it("نسبة 30% تقسم الخصم", () => {
    const r = computeSubsidy(100, 80, 2, 30);
    expect(r.discount).toBe(40);
    expect(r.sellerPart).toBe(12);
    expect(r.platformSubsidy).toBe(28);
  });
  it("لا خصم سالب ولا نسبة خارج 0-100", () => {
    expect(computeSubsidy(50, 70, 1, 0).platformSubsidy).toBe(0);
    expect(computeSubsidy(100, 90, 1, 250).platformSubsidy).toBe(0);
    expect(computeSubsidy(100, 90, 1, -5).platformSubsidy).toBe(10);
  });
  it("التقريب لرقمين ومجموع الجزأين = الخصم", () => {
    const r = computeSubsidy(10, 6.67, 3, 33.33);
    expect(Math.round((r.sellerPart + r.platformSubsidy) * 100) / 100).toBe(r.discount);
  });
});

describe("getActiveDeals: الموافقة والنسبة", () => {
  it("يطلب المعتمد فقط ويرجع نسبة التاجر", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 7,
        saleId: 1,
        productId: 5,
        dealPrice: 80,
        quantityLimit: null,
        soldCount: 0,
        sellerSharePct: 25,
        sale: { endsAt: new Date("2030-01-01") },
      },
    ]);
    const db: any = {
      flashSaleItem: { findMany },
      productVariant: { findMany: vi.fn().mockResolvedValue([{ productId: 5, price: 100 }]) },
    };
    const m = await FlashDealService.getActiveDeals(db, [5]);
    expect(findMany.mock.calls[0][0].where.status).toBe("APPROVED");
    expect(m.get(5)?.sellerSharePct).toBe(25);
  });
  it("نسبة غير موجودة تُعتبر 0", async () => {
    const db: any = {
      flashSaleItem: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, saleId: 1, productId: 5, dealPrice: 80, quantityLimit: null, soldCount: 0, sale: { endsAt: new Date("2030-01-01") } },
        ]),
      },
      productVariant: { findMany: vi.fn().mockResolvedValue([{ productId: 5, price: 100 }]) },
    };
    const m = await FlashDealService.getActiveDeals(db, [5]);
    expect(m.get(5)?.sellerSharePct).toBe(0);
  });
});