import { describe, it, expect, vi } from "vitest";

vi.mock("./pool.service", () => ({
  PoolService: { syncInventoryToPool: vi.fn() },
}));

import { InventoryService } from "./inventory.service";
import { PoolService } from "./pool.service";
import { createFakeDb } from "./testing/fake-db";

async function setup() {
  const s = createFakeDb({
    variants: [{ id: 1, sellerId: 1, productId: 1 }],
    inventory: [{ variantId: 1, quantity: 10 }],
  });
  await InventoryService.addDefective(s.tx, 1, 5, {
    referenceType: "STORE_SALE_RETURN",
    referenceId: 1,
    performedById: 9,
    reason: "سلعة بها عيب",
  });
  return s;
}

describe("InventoryService.resolveDefective", () => {
  const who = { performedById: 9, reason: "سبب واضح" };

  it("WRITE_OFF removes from defective only", async () => {
    const { tx, db } = await setup();
    const r = await InventoryService.resolveDefective(tx, 1, 2, "WRITE_OFF", who);
    expect(r.defectiveAfter).toBe(3);
    expect(db.inventory[0].defectiveQuantity).toBe(3);
    expect(db.inventory[0].quantity).toBe(10);
    const last = db.movements[db.movements.length - 1];
    expect(last.stockBucket).toBe("DEFECTIVE");
    expect(last.quantityChange).toBe(-2);
  });

  it("RESTOCK moves from defective to sellable and syncs the pool", async () => {
    const { tx, db } = await setup();
    const before = db.movements.length;
    await InventoryService.resolveDefective(tx, 1, 3, "RESTOCK", who);
    expect(db.inventory[0].defectiveQuantity).toBe(2);
    expect(db.inventory[0].quantity).toBe(13);
    expect(db.movements.length).toBe(before + 2);
    expect(PoolService.syncInventoryToPool).toHaveBeenCalled();
  });

  it("rejects more than the defective stock", async () => {
    const { tx, db } = await setup();
    await expect(InventoryService.resolveDefective(tx, 1, 6, "WRITE_OFF", who)).rejects.toThrow();
    expect(db.inventory[0].defectiveQuantity).toBe(5);
  });

  it("rejects bad quantity, bad action and short reason", async () => {
    const { tx } = await setup();
    await expect(InventoryService.resolveDefective(tx, 1, 0, "WRITE_OFF", who)).rejects.toThrow();
    await expect(InventoryService.resolveDefective(tx, 1, 1, "WRITE_OFF", { performedById: 9, reason: "x" })).rejects.toThrow();
    await expect(InventoryService.resolveDefective(tx, 1, 1, "OTHER" as never, who)).rejects.toThrow();
  });
});