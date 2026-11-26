import { describe, it, expect, vi } from "vitest";

vi.mock("./pool.service", () => ({
  PoolService: { syncInventoryToPool: vi.fn() },
}));

import { InventoryService } from "./inventory.service";

function makeTx(invs: { id: number; variantId: number; quantity: number; reservedQuantity: number }[]) {
  const created: Record<string, unknown>[] = [];
  const tx: any = {
    inventory: { findMany: async () => invs },
    inventoryMovement: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
      },
    },
  };
  return { tx, created };
}

describe("InventoryService.recordOpening", () => {
  const invs = [
    { id: 1, variantId: 10, quantity: 5, reservedQuantity: 0 },
    { id: 2, variantId: 11, quantity: 0, reservedQuantity: 0 },
  ];

  it("records an OPENING movement only for variants with quantity", async () => {
    const { tx, created } = makeTx(invs);
    const r = await InventoryService.recordOpening(
      tx,
      [{ variantId: 10, quantity: 5 }, { variantId: 11, quantity: 0 }],
      7,
      "رصيد افتتاحي"
    );
    expect(r.recorded).toBe(1);
    expect(created.length).toBe(1);
    expect(created[0].type).toBe("OPENING");
    expect(created[0].beforeQuantity).toBe(0);
    expect(created[0].afterQuantity).toBe(5);
    expect(created[0].quantityChange).toBe(5);
    expect(created[0].referenceType).toBe("MANUAL");
    expect(created[0].performedById).toBe(7);
  });

  it("ignores invalid quantities and unknown variants", async () => {
    const { tx, created } = makeTx(invs);
    const r = await InventoryService.recordOpening(
      tx,
      [{ variantId: 10, quantity: -3 }, { variantId: 10, quantity: 1.5 }, { variantId: 99, quantity: 4 }],
      7,
      "x"
    );
    expect(r.recorded).toBe(0);
    expect(created.length).toBe(0);
  });
});