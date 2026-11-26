import { describe, it, expect, vi } from "vitest";

vi.mock("./pool.service", () => ({
  PoolService: { syncInventoryToPool: vi.fn() },
}));

import { InventoryService } from "./inventory.service";
import { PoolService } from "./pool.service";

function makeTx(quantity: number) {
  const row = { id: 1, quantity, reservedQuantity: 2, lowStockThreshold: 5, defectiveQuantity: 0 };
  const updates: { where: { id: number }; data: { quantity: number } }[] = [];
  const moves: Record<string, unknown>[] = [];
  const tx = {
    $queryRaw: async () => [row],
    inventory: {
      update: async (a: { where: { id: number }; data: { quantity: number } }) => {
        updates.push(a);
      },
    },
    inventoryMovement: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        moves.push(data);
      },
    },
  };
  return { tx, updates, moves };
}

describe("InventoryService.transferSet / transferDelta", () => {
  it("sets quantity, logs a TRANSFER movement and never syncs the pool", async () => {
    const { tx, updates, moves } = makeTx(10);
    const r = await InventoryService.transferSet(tx, 5, 4, 9, "تحويل");
    expect(r.changed).toBe(-6);
    expect(updates[0].data.quantity).toBe(4);
    expect(moves.length).toBe(1);
    expect(moves[0].type).toBe("ADJUSTMENT");
    expect(moves[0].referenceType).toBe("TRANSFER");
    expect(moves[0].beforeQuantity).toBe(10);
    expect(moves[0].afterQuantity).toBe(4);
    expect(moves[0].quantityChange).toBe(-6);
    expect(moves[0].performedById).toBe(9);
    expect(PoolService.syncInventoryToPool).not.toHaveBeenCalled();
  });

  it("is a no-op when the quantity does not change", async () => {
    const { tx, updates, moves } = makeTx(10);
    const r = await InventoryService.transferSet(tx, 5, 10, 9, "x");
    expect(r.changed).toBe(0);
    expect(updates.length).toBe(0);
    expect(moves.length).toBe(0);
  });

  it("rejects negative or fractional quantities", async () => {
    const { tx } = makeTx(10);
    await expect(InventoryService.transferSet(tx, 5, -1, 9, "x")).rejects.toThrow();
    await expect(InventoryService.transferSet(tx, 5, 1.5, 9, "x")).rejects.toThrow();
  });

  it("transferDelta adds to the current quantity", async () => {
    const { tx, updates, moves } = makeTx(10);
    const r = await InventoryService.transferDelta(tx, 5, 7, 9, "x");
    expect(r.changed).toBe(7);
    expect(updates[0].data.quantity).toBe(17);
    expect(moves[0].quantityChange).toBe(7);
  });
});