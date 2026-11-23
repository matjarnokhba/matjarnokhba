import { describe, it, expect, vi } from "vitest";

vi.mock("./pool.service", () => ({
  PoolService: { syncInventoryToPool: vi.fn() },
}));

import { InventoryService } from "./inventory.service";

type Mv = { referenceType: string; referenceId: bigint; type: string; inventoryId: number };

function fakeTx(initialQty: number, existing: Mv[] = []) {
  const movements: any[] = [...existing];
  const state = { quantity: initialQty };
  const tx: any = {
    $queryRaw: vi.fn(async () => [
      { id: 1, quantity: state.quantity, reservedQuantity: 0, lowStockThreshold: 5 },
    ]),
    inventoryMovement: {
      findFirst: vi.fn(async ({ where }: any) => {
        const hit = movements.find(
          (m) =>
            m.referenceType === where.referenceType &&
            m.referenceId === where.referenceId &&
            m.type === where.type &&
            m.inventoryId === where.inventoryId
        );
        return hit ? { id: BigInt(1) } : null;
      }),
      create: vi.fn(async ({ data }: any) => {
        movements.push(data);
        return data;
      }),
    },
    inventory: {
      update: vi.fn(async ({ data }: any) => {
        state.quantity = data.quantity;
      }),
    },
  };
  return { tx, movements, state };
}

describe("InventoryService.saleDirect reference types", () => {
  it("a store sale is NOT blocked by an ORDER movement with the same id", async () => {
    const { tx, movements, state } = fakeTx(10, [
      { referenceType: "ORDER", referenceId: BigInt(7), type: "SALE", inventoryId: 1 },
    ]);
    const r = await InventoryService.saleDirect(tx, 1, 2, 7, "STORE_SALE");
    expect(r.idempotent).toBe(false);
    expect(state.quantity).toBe(8);
    expect(movements[movements.length - 1].referenceType).toBe("STORE_SALE");
  });

  it("an ORDER sale (default) is still idempotent for the same order id", async () => {
    const { tx, state } = fakeTx(10, [
      { referenceType: "ORDER", referenceId: BigInt(7), type: "SALE", inventoryId: 1 },
    ]);
    const r = await InventoryService.saleDirect(tx, 1, 2, 7);
    expect(r.idempotent).toBe(true);
    expect(state.quantity).toBe(10);
  });

  it("replaying the same store sale is idempotent", async () => {
    const { tx, state } = fakeTx(10);
    await InventoryService.saleDirect(tx, 1, 2, 7, "STORE_SALE");
    const again = await InventoryService.saleDirect(tx, 1, 2, 7, "STORE_SALE");
    expect(again.idempotent).toBe(true);
    expect(state.quantity).toBe(8);
  });

  it("rejects selling more than available", async () => {
    const { tx } = fakeTx(1);
    await expect(InventoryService.saleDirect(tx, 1, 2, 9, "STORE_SALE")).rejects.toThrow();
  });
});