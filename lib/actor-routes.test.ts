import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ user: { id: 1, role: "ADMIN" } as any, scope: null as any, prisma: {} as any }));
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/services/session.service", () => ({ SessionService: { getCurrent: vi.fn(async () => ({ user: h.user })) } }));
vi.mock("@/services/logistics-scope.service", () => ({ LogisticsScopeService: { forUser: vi.fn(async () => h.scope) } }));

import { POST as cashCreate } from "../app/api/warehouse/cash-handover/create/route";
import { POST as payoutCreate } from "../app/api/warehouse/driver-payout/create/route";
import { GET as walletGet } from "../app/api/warehouse/wallet/route";

const MULTI: any = { platform: true, companyIds: [], warehouseIds: [1, 2] };
const post = (body: any) => new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  h.user = { id: 1, role: "ADMIN" };
  h.scope = MULTI;
  for (const k of Object.keys(h.prisma)) delete h.prisma[k];
  h.prisma.user = { findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }) };
  h.prisma.deliveryPerson = {
    findFirst: vi.fn().mockResolvedValue({ id: 3 }),
    findUnique: vi.fn().mockResolvedValue({ companyId: 1 }),
    findMany: vi.fn().mockResolvedValue([]),
  };
  h.prisma.warehouse = { findUnique: vi.fn(async ({ where }: any) => ({ companyId: where.id === 2 ? 2 : 1 })) };
  h.prisma.wallet = {
    findUnique: vi.fn().mockResolvedValue({ cashInHand: 100, balance: 100, isBlocked: false, cashOwedToPlatform: 0, transactions: [] }),
    findMany: vi.fn().mockResolvedValue([]),
  };
  h.prisma.cashHandover = { create: vi.fn().mockResolvedValue({ id: 1 }) };
  h.prisma.driverPayout = { create: vi.fn().mockResolvedValue({ id: 1 }) };
});

describe("cash-handover/create: المستودع", () => {
  const body = (extra: any = {}) => post({ driverId: 3, actualAmount: 50, ...extra });
  it("بعدة مستودعات وبلا تحديد: 400 ولا إنشاء", async () => {
    const res = await cashCreate(body());
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/حدد المستودع/);
    expect(h.prisma.cashHandover.create).not.toHaveBeenCalled();
  });
  it("مستودع ضمن النطاق: يُسجَّل به", async () => {
    const res = await cashCreate(body({ warehouseId: 1 }));
    expect(res.status).toBe(200);
    expect(h.prisma.cashHandover.create.mock.calls[0][0].data.warehouseRefId).toBe(1);
  });
  it("مستودع شركة أخرى غير سائقه: 409 ولا إنشاء", async () => {
    const res = await cashCreate(body({ warehouseId: 2 }));
    expect(res.status).toBe(409);
    expect(h.prisma.cashHandover.create).not.toHaveBeenCalled();
  });
  it("مستودع خارج النطاق: 403", async () => {
    const res = await cashCreate(body({ warehouseId: 99 }));
    expect(res.status).toBe(403);
    expect(h.prisma.cashHandover.create).not.toHaveBeenCalled();
  });
});

describe("driver-payout/create: المستودع", () => {
  const body = (extra: any = {}) => post({ driverId: 3, amount: 10, method: "CASH", ...extra });
  it("بعدة مستودعات وبلا تحديد: 400 ولا إنشاء", async () => {
    const res = await payoutCreate(body());
    expect(res.status).toBe(400);
    expect(h.prisma.driverPayout.create).not.toHaveBeenCalled();
  });
  it("مستودع ضمن النطاق: يُسجَّل به", async () => {
    const res = await payoutCreate(body({ warehouseId: 1 }));
    expect(res.status).toBe(200);
    expect(h.prisma.driverPayout.create.mock.calls[0][0].data.warehouseRefId).toBe(1);
  });
  it("مستودع شركة أخرى غير سائقه: 409", async () => {
    const res = await payoutCreate(body({ warehouseId: 2 }));
    expect(res.status).toBe(409);
    expect(h.prisma.driverPayout.create).not.toHaveBeenCalled();
  });
});

describe("wallet GET: المستودع", () => {
  it("بعدة مستودعات وبلا تحديد: 400", async () => {
    const res = await walletGet(new Request("http://localhost/x"));
    expect(res.status).toBe(400);
  });
  it("مستودع محدد: يُقرأ محفظته", async () => {
    const res = await walletGet(new Request("http://localhost/x?warehouseId=1"));
    expect(res.status).toBe(200);
    expect(h.prisma.wallet.findUnique.mock.calls[0][0].where.ownerType_ownerId).toEqual({ ownerType: "WAREHOUSE", ownerId: 1 });
  });
  it("مستودع غير موجود: 404", async () => {
    h.prisma.warehouse.findUnique = vi.fn().mockResolvedValue(null);
    h.scope = { platform: true, companyIds: [], warehouseIds: [1, 2, 9] };
    const res = await walletGet(new Request("http://localhost/x?warehouseId=9"));
    expect(res.status).toBe(404);
  });
});
