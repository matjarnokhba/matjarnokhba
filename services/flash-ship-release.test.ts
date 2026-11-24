import { describe, it, expect, vi } from "vitest";
import { FlashDealService } from "./flash-deal.service";

describe("FlashDealService.releaseForShipmentItems", () => {
  it("يعيد كامل الكمية ويعكس السطر عند اكتمال كمية البند", async () => {
    const tx: any = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      flashSaleOrderLine: {
        findMany: vi.fn().mockResolvedValue([{ id: 1, orderItemId: 50, flashSaleItemId: 9, quantity: 2 }]),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    await FlashDealService.releaseForShipmentItems(tx, [{ orderItemId: 50, quantity: 2 }]);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.flashSaleOrderLine.update).toHaveBeenCalledTimes(1);
  });
  it("كمية أقل من كمية البند تعيد الحصة بلا عكس السطر", async () => {
    const tx: any = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      flashSaleOrderLine: {
        findMany: vi.fn().mockResolvedValue([{ id: 1, orderItemId: 50, flashSaleItemId: 9, quantity: 5 }]),
        update: vi.fn(),
      },
    };
    await FlashDealService.releaseForShipmentItems(tx, [{ orderItemId: 50, quantity: 2 }]);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.flashSaleOrderLine.update).not.toHaveBeenCalled();
  });
  it("لا يتجاوز كمية السطر ولا يفعل شيئاً بلا بنود", async () => {
    const tx: any = {
      $executeRaw: vi.fn(),
      flashSaleOrderLine: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    };
    await FlashDealService.releaseForShipmentItems(tx, []);
    await FlashDealService.releaseForShipmentItems(tx, [{ orderItemId: 1, quantity: 1 }]);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
});