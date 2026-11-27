import { describe, it, expect } from "vitest";
import { resolveScope } from "./logistics-scope";
import { resolveActorWarehouseId } from "./actor-warehouse";

const warehouses = [
  { id: 5, companyId: 1 },
  { id: 6, companyId: 1 },
  { id: 7, companyId: 2 },
];
const mem = (id: number) => ({ scope: "WAREHOUSE" as const, companyId: 1, warehouseId: id, jobRoles: ["MANAGER"], status: "ACTIVE" as const });

describe("resolveActorWarehouseId", () => {
  it("admin defaults to 1 and may pick any warehouse", () => {
    const s = resolveScope({ role: "ADMIN", memberships: [], warehouses });
    expect(resolveActorWarehouseId(s)).toBe(1);
    expect(resolveActorWarehouseId(s, 7)).toBe(7);
  });
  it("manager gets his own warehouse", () => {
    const s = resolveScope({ role: "CUSTOMER", memberships: [mem(5), mem(6)], warehouses });
    expect(resolveActorWarehouseId(s)).toBe(5);
    expect(resolveActorWarehouseId(s, 6)).toBe(6);
  });
  it("a requested warehouse outside the scope is ignored", () => {
    const s = resolveScope({ role: "CUSTOMER", memberships: [mem(5)], warehouses });
    expect(resolveActorWarehouseId(s, 7)).toBe(5);
  });
  it("no scope falls back to 1", () => {
    const s = resolveScope({ role: "CUSTOMER", memberships: [], warehouses });
    expect(resolveActorWarehouseId(s)).toBe(1);
  });
});