import { describe, it, expect } from "vitest";
import { resolveScope } from "./logistics-scope";
import { resolveActorWarehouseId } from "./actor-warehouse";

const warehouses = [
  { id: 5, companyId: 1 },
  { id: 6, companyId: 1 },
  { id: 7, companyId: 2 },
];
const mem = (id: number) => ({ scope: "WAREHOUSE" as const, companyId: 1, warehouseId: id, jobRoles: ["MANAGER"], status: "ACTIVE" as const });

describe("resolveActorWarehouseId (بلا احتياط إلى 1)", () => {
  it("أدمن بعدة مستودعات: يجب أن يحدد، ويقبل أي مستودع موجود", () => {
    const s = resolveScope({ role: "ADMIN", memberships: [], warehouses });
    expect(() => resolveActorWarehouseId(s)).toThrowError(/حدد المستودع/);
    expect(resolveActorWarehouseId(s, 7)).toBe(7);
    expect(() => resolveActorWarehouseId(s, 999)).toThrowError(/خارج صلاحياتك/);
  });
  it("أدمن بمستودع واحد في النظام: يُستعمل تلقائياً", () => {
    const s = resolveScope({ role: "ADMIN", memberships: [], warehouses: [{ id: 5, companyId: 1 }] });
    expect(resolveActorWarehouseId(s)).toBe(5);
  });
  it("مدير بمستودع واحد: مستودعه", () => {
    const s = resolveScope({ role: "CUSTOMER", memberships: [mem(5)], warehouses });
    expect(resolveActorWarehouseId(s)).toBe(5);
    expect(resolveActorWarehouseId(s, 5)).toBe(5);
  });
  it("مدير بمستودعين: يجب أن يحدد", () => {
    const s = resolveScope({ role: "CUSTOMER", memberships: [mem(5), mem(6)], warehouses });
    expect(() => resolveActorWarehouseId(s)).toThrowError(/حدد المستودع/);
    expect(resolveActorWarehouseId(s, 6)).toBe(6);
  });
  it("مستودع خارج النطاق يُرفض بدل أن يُتجاهل", () => {
    const s = resolveScope({ role: "CUSTOMER", memberships: [mem(5)], warehouses });
    expect(() => resolveActorWarehouseId(s, 7)).toThrowError(/خارج صلاحياتك/);
  });
  it("بلا نطاق: 403 وليس مستودع 1", () => {
    const s = resolveScope({ role: "CUSTOMER", memberships: [], warehouses });
    expect(() => resolveActorWarehouseId(s)).toThrowError(/لا تملك صلاحية على أي مستودع/);
  });
});
