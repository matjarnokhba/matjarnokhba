import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ prisma: {} as any, user: { id: 1, role: "ADMIN" } as any }));
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/services/session.service", () => ({ SessionService: { getCurrent: vi.fn(async () => ({ user: h.user })) } }));

import { POST as adminHandover } from "../app/api/admin/handover/confirm/route";
import { POST as cashHandover } from "../app/api/delivery/cash-handover/confirm/route";
import { POST as driverPayout } from "../app/api/delivery/driver-payout/confirm/route";

const TOKEN = "123e4567-e89b-42d3-a456-426614174000";
const req = () => new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: TOKEN }) });
const ownerIds = (fn: any) => fn.mock.calls.map((c: any) => c[0].where.ownerType_ownerId.ownerId);

function makeTx() {
  return {
    adminCashHandover: { update: vi.fn().mockResolvedValue({}) },
    cashHandover: { update: vi.fn().mockResolvedValue({}) },
    driverPayout: { update: vi.fn().mockResolvedValue({}) },
    shipment: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({}) },
    wallet: {
      findUnique: vi.fn().mockResolvedValue({ id: 50, cashInHand: 500 }),
      update: vi.fn().mockResolvedValue({}),
      upsert: vi.fn().mockResolvedValue({ id: 60 }),
    },
    walletTransactionUnified: { create: vi.fn().mockResolvedValue({}) },
  } as any;
}

beforeEach(() => {
  for (const k of Object.keys(h.prisma)) delete h.prisma[k];
});

describe("admin/handover/confirm", () => {
  it("بلا مستودع: 409 واضح بلا أي حركة مالية", async () => {
    h.user = { id: 1, role: "ADMIN" };
    h.prisma.adminCashHandover = { findUnique: vi.fn().mockResolvedValue({ id: 1, status: "PENDING", amount: 100, warehouseRefId: null }) };
    h.prisma.$transaction = vi.fn();
    const res = await adminHandover(req());
    const j = await res.json();
    expect(res.status).toBe(409);
    expect(j.success).toBe(false);
    expect(String(j.message)).toMatch(/غير مرتبط بمستودع/);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("بمستودع 7: تُخصم من محفظة المستودع 7 فقط", async () => {
    const tx = makeTx();
    h.prisma.adminCashHandover = { findUnique: vi.fn().mockResolvedValue({ id: 1, status: "PENDING", amount: 100, warehouseRefId: 7 }) };
    h.prisma.$transaction = vi.fn(async (fn: any) => fn(tx));
    const res = await adminHandover(req());
    expect(res.status).toBe(200);
    expect(ownerIds(tx.wallet.findUnique)).toEqual([7]);
  });
});

describe("delivery/cash-handover/confirm", () => {
  const setup = (warehouseRefId: number | null) => {
    h.user = { id: 2, role: "DELIVERY" };
    const tx = makeTx();
    h.prisma.deliveryPerson = { findUnique: vi.fn().mockResolvedValue({ id: 3 }) };
    h.prisma.cashHandover = { findUnique: vi.fn().mockResolvedValue({ id: 1, driverId: 3, status: "PENDING", amount: 100, shortfall: 0, warehouseRefId }) };
    h.prisma.$transaction = vi.fn(async (fn: any) => fn(tx));
    return tx;
  };
  it("بلا مستودع: 409 واضح بلا أي حركة مالية", async () => {
    setup(null);
    const res = await cashHandover(req());
    const j = await res.json();
    expect(res.status).toBe(409);
    expect(String(j.message)).toMatch(/غير مرتبط بمستودع/);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("بمستودع 7: تُضاف الأموال لمحفظة المستودع 7", async () => {
    const tx = setup(7);
    const res = await cashHandover(req());
    expect(res.status).toBe(200);
    const a = tx.wallet.upsert.mock.calls[0][0];
    expect(a.where.ownerType_ownerId).toEqual({ ownerType: "WAREHOUSE", ownerId: 7 });
    expect(a.create.ownerId).toBe(7);
  });
});

describe("delivery/driver-payout/confirm", () => {
  const setup = (warehouseRefId: number | null) => {
    h.user = { id: 2, role: "DELIVERY" };
    const tx = makeTx();
    h.prisma.deliveryPerson = { findUnique: vi.fn().mockResolvedValue({ id: 3 }) };
    h.prisma.driverPayout = { findUnique: vi.fn().mockResolvedValue({ id: 1, driverId: 3, status: "PENDING", amount: 40, method: "CASH", warehouseRefId }) };
    h.prisma.$transaction = vi.fn(async (fn: any) => fn(tx));
    return tx;
  };
  it("بلا مستودع: 409 واضح بلا أي حركة مالية", async () => {
    setup(null);
    const res = await driverPayout(req());
    const j = await res.json();
    expect(res.status).toBe(409);
    expect(String(j.message)).toMatch(/غير مرتبطة بمستودع/);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("بمستودع 7: يُخصم من محفظة المستودع 7 لا غيره", async () => {
    const tx = setup(7);
    const res = await driverPayout(req());
    expect(res.status).toBe(200);
    const ids = ownerIds(tx.wallet.findUnique);
    expect(ids[ids.length - 1]).toBe(7);
    expect(ids).not.toContain(1);
  });
});
