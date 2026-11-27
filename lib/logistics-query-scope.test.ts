import { describe, it, expect } from "vitest";
import { resolveScope } from "./logistics-scope";
import { warehouseWhere, companyWhere, inWarehouseScope } from "./logistics-query-scope";

const warehouses = [
  { id: 5, companyId: 1 },
  { id: 6, companyId: 1 },
  { id: 7, companyId: 2 },
];
const member = {
  scope: "WAREHOUSE" as const,
  companyId: 1,
  warehouseId: 5,
  jobRoles: ["MANAGER"],
  status: "ACTIVE" as const,
};

describe("query scope helpers", () => {
  it("admin is unrestricted", () => {
    const s = resolveScope({ role: "ADMIN", memberships: [], warehouses });
    expect(warehouseWhere(s)).toEqual({});
    expect(companyWhere(s)).toEqual({});
    expect(inWarehouseScope(s, 7)).toBe(true);
  });
  it("warehouse member sees only his warehouse", () => {
    const s = resolveScope({ role: "CUSTOMER", memberships: [member], warehouses });
    expect(warehouseWhere(s)).toEqual({ warehouseRefId: { in: [5] } });
    expect(warehouseWhere(s, "originWarehouseId")).toEqual({ originWarehouseId: { in: [5] } });
    expect(inWarehouseScope(s, 5)).toBe(true);
    expect(inWarehouseScope(s, 6)).toBe(false);
    expect(inWarehouseScope(s, null)).toBe(false);
  });
  it("no membership sees nothing", () => {
    const s = resolveScope({ role: "CUSTOMER", memberships: [], warehouses });
    expect(warehouseWhere(s)).toEqual({ warehouseRefId: { in: [] } });
    expect(inWarehouseScope(s, 5)).toBe(false);
  });
});