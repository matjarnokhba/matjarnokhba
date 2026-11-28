import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ user: { id: 9, role: "WAREHOUSE_MANAGER" } as any, scope: null as any, prisma: {} as any }));
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/services/session.service", () => ({ SessionService: { getCurrent: vi.fn(async () => ({ user: h.user })) } }));
vi.mock("@/services/logistics-scope.service", () => ({ LogisticsScopeService: { forUser: vi.fn(async () => h.scope) } }));

import { resolveBatchWarehouseId } from "./batch-warehouse";
import { POST as handoverCreate } from "../app/api/warehouse/handover/create/route";

const rowsFor = (...whs: number[]) => whs.map((w) => ({ shipment: { originWarehouseId: w } }));
const MULTI: any = { platform: false, companyIds: [], warehouseIds: [1, 2] };

beforeEach(() => {
  h.user = { id: 9, role: "WAREHOUSE_MANAGER" };
  h.scope = MULTI;
  for (const k of Object.keys(h.prisma)) delete h.prisma[k];
  h.prisma.user = { findUnique: vi.fn().mockResolvedValue({ role: "WAREHOUSE_MANAGER" }) };
});

describe("resolveBatchWarehouseId", () => {
  it("كل الأصناف من مستودع واحد ضمن نطاقه: يُستعمل", async () => {
    const db = { shipmentItem: { findMany: vi.fn().mockResolvedValue(rowsFor(2, 2, 2)) } };
    expect(await resolveBatchWarehouseId(db, [1, 2, 3], 9)).toBe(2);
  });
  it("أصناف من مستودعين: 409 واضح", async () => {
    const db = { shipmentItem: { findMany: vi.fn().mockResolvedValue(rowsFor(1, 2)) } };
    await expect(resolveBatchWarehouseId(db, [1, 2], 9)).rejects.toMatchObject({ status: 409 });
  });
  it("بلا أصناف: 409", async () => {
    const db = { shipmentItem: { findMany: vi.fn() } };
    await expect(resolveBatchWarehouseId(db, [], 9)).rejects.toMatchObject({ status: 409 });
    expect(db.shipmentItem.findMany).not.toHaveBeenCalled();
  });
  it("مستودع الأصناف خارج نطاق المستخدم: 403", async () => {
    const db = { shipmentItem: { findMany: vi.fn().mockResolvedValue(rowsFor(7)) } };
    await expect(resolveBatchWarehouseId(db, [1], 9)).rejects.toMatchObject({ status: 403 });
  });
});

describe("warehouse/handover/create", () => {
  const post = (body: any) => new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  beforeEach(() => {
    h.prisma.wallet = { findUnique: vi.fn().mockResolvedValue({ cashInHand: 100 }) };
    h.prisma.adminCashHandover = { create: vi.fn().mockResolvedValue({ id: 1 }) };
  });
  it("مدير بمستودعين وبلا تحديد: 400 واضح", async () => {
    const res = await handoverCreate(post({ amount: 10 }));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/حدد المستودع/);
    expect(h.prisma.adminCashHandover.create).not.toHaveBeenCalled();
  });
  it("مستودع محدد ضمن نطاقه: يُسجَّل به", async () => {
    const res = await handoverCreate(post({ amount: 10, warehouseId: 2 }));
    expect(res.status).toBe(200);
    expect(h.prisma.adminCashHandover.create.mock.calls[0][0].data.warehouseRefId).toBe(2);
    expect(h.prisma.wallet.findUnique.mock.calls[0][0].where.ownerType_ownerId.ownerId).toBe(2);
  });
  it("مستودع خارج نطاقه: 403 ولا إنشاء", async () => {
    const res = await handoverCreate(post({ amount: 10, warehouseId: 99 }));
    expect(res.status).toBe(403);
    expect(h.prisma.adminCashHandover.create).not.toHaveBeenCalled();
  });
});
