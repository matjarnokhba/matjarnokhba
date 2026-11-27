import { describe, it, expect } from "vitest";
import { checkSingleWarehouse } from "./shipment-guard";

describe("checkSingleWarehouse", () => {
  it("accepts one warehouse", () => {
    const r = checkSingleWarehouse([3, 3, 3]);
    expect(r.ok && r.warehouseId === 3).toBe(true);
  });
  it("ignores unknown warehouses", () => {
    const r = checkSingleWarehouse([null, 4, undefined]);
    expect(r.ok && r.warehouseId === 4).toBe(true);
    const e = checkSingleWarehouse([null]);
    expect(e.ok && e.warehouseId === null).toBe(true);
  });
  it("rejects mixed warehouses with a message", () => {
    const r = checkSingleWarehouse([1, 2]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("مستودعات مختلفة");
  });
});