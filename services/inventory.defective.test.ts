import { describe, it, expect, vi } from "vitest";

vi.mock("./pool.service", () => ({
  PoolService: { syncInventoryToPool: vi.fn() },
}));

import { InventoryService } from "./inventory.service";
import { createFakeDb } from "./testing/fake-db";

function setup() {
  return createFakeDb({
    variants: [{ id: 1, sellerId: 1, productId: 1 }],
    inventory: [{ variantId: 1, quantity: 10 }],
  });
}

describe("InventoryService.addDefective", () => {
  const opts = { referenceType: "STORE_SALE_RETURN" as const, referenceId: 5, performedById: 9, reason: "سلعة بها عيب" };

  it("goes to the defective bucket and never to sellable stock", async () => {
    const { tx, db } = setup();
    const r = await InventoryService.addDefective(tx, 1, 2, opts);
    expect(r.idempotent).toBe(false);
    expect(db.inventory[0].quantity).toBe(10);
    expect(db.inventory[0].defectiveQuantity).toBe(2);
    const mv = db.movements[0];
    expect(mv.stockBucket).toBe("DEFECTIVE");
    expect(mv.beforeQuantity).toBe(0);
    expect(mv.afterQuantity).toBe(2);
    expect(mv.referenceType).toBe("STORE_SALE_RETURN");
  });

  it("is idempotent for the same reference", async () => {
    const { tx, db } = setup();
    await InventoryService.addDefective(tx, 1, 2, opts);
    const again = await InventoryService.addDefective(tx, 1, 2, opts);
    expect(again.idempotent).toBe(true);
    expect(db.inventory[0].defectiveQuantity).toBe(2);
  });

  it("rejects non-positive quantities", async () => {
    const { tx } = setup();
    await expect(InventoryService.addDefective(tx, 1, 0, opts)).rejects.toThrow();
    await expect(InventoryService.addDefective(tx, 1, -1, opts)).rejects.toThrow();
  });
});

describe("InventoryService.receiveStock", () => {
  it("is idempotent per receipt item", async () => {
    const { tx, db, qty } = setup();
    const o = { receiptItemId: 3, performedById: 9, reason: "اختبار" };
    await InventoryService.receiveStock(tx, 1, 4, o);
    const again = await InventoryService.receiveStock(tx, 1, 4, o);
    expect(again.idempotent).toBe(true);
    expect(qty(1)).toBe(14);
    expect(db.movements.length).toBe(1);
  });
});