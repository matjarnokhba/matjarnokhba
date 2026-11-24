import { describe, it, expect, vi } from "vitest";
import { FlashDealService } from "./flash-deal.service";

describe("FlashDealService.releaseQuota", () => {
  it("ينفذ تحديثاً واحداً للكمية الموجبة", async () => {
    const tx: any = { $executeRaw: vi.fn().mockResolvedValue(1) };
    await FlashDealService.releaseQuota(tx, 9, 3);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
  it("لا يفعل شيئاً للكمية صفر أو سالبة", async () => {
    const tx: any = { $executeRaw: vi.fn() };
    await FlashDealService.releaseQuota(tx, 9, 0);
    await FlashDealService.releaseQuota(tx, 9, -2);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
});

describe("FlashDealService.releaseForOrderVariant", () => {
  it("يعيد الحصة ويعلّم كل سطر غير مسوّى معكوساً", async () => {
    const tx: any = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      flashSaleOrderLine: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, flashSaleItemId: 9, quantity: 2 },
          { id: 2, flashSaleItemId: 9, quantity: 1 },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    await FlashDealService.releaseForOrderVariant(tx, 100, 7);
    const where = tx.flashSaleOrderLine.findMany.mock.calls[0][0].where;
    expect(where.settledAt).toBeNull();
    expect(where.reversedAt).toBeNull();
    expect(where.orderItem).toEqual({ orderId: 100, variantId: 7 });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.flashSaleOrderLine.update).toHaveBeenCalledTimes(2);
    expect(tx.flashSaleOrderLine.update.mock.calls[0][0].data.reversedAt).toBeInstanceOf(Date);
  });
  it("بلا أسطر عرض لا يحدث شيء", async () => {
    const tx: any = {
      $executeRaw: vi.fn(),
      flashSaleOrderLine: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    };
    await FlashDealService.releaseForOrderVariant(tx, 1, 1);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.flashSaleOrderLine.update).not.toHaveBeenCalled();
  });
  it("يتحمل غياب جدول التسوية في tx (اختبارات قديمة)", async () => {
    await expect(FlashDealService.releaseForOrderVariant({} as any, 1, 1)).resolves.toBeUndefined();
  });
});