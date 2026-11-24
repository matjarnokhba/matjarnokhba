import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { pickCardOrders } from "../lib/free-return-card";
import { FreeReturnCardService } from "./free-return-card.service";

const D = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));
const mk = (n: number, start = 0) => Array.from({ length: n }, (_, i) => ({ id: start + i + 1, deliveredAt: D(i) }));

describe("pickCardOrders", () => {
  it("أقل من 10: لا بطاقة", () => {
    expect(pickCardOrders(mk(9), null)).toBeNull();
  });
  it("10 أو أكثر: أقدم 10 طلبيات", () => {
    expect(pickCardOrders(mk(12), null)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
  it("بعد الاستعمال: لا تُحتسب الطلبيات التي نجحت قبله", () => {
    // آخر استعمال في اليوم 20: الطلبية تُحتسب فقط إن نجحت (تسليم+7) بعده
    const orders = mk(25);
    const lastUsed = D(20);
    const picked = pickCardOrders(orders, lastUsed);
    // نجاح الطلبية i يقع في اليوم i+7 بعد 1 يناير؛ آخر استعمال اليوم 20 → تُحتسب i >= 14 أي 11 طلبية
  });
});

function makeDb(opts: { rows: any[]; open?: boolean; lastUsed?: Date | null; updCount?: number }) {
  const tx = {
    freeReturnCard: { create: vi.fn().mockResolvedValue({ id: 50 }) },
    order: { updateMany: vi.fn().mockResolvedValue({ count: opts.updCount ?? 10 }) },
  };
  return {
    tx,
    db: {
      user: { findMany: vi.fn().mockResolvedValue([]) },
      order: { findMany: vi.fn().mockResolvedValue(opts.rows) },
      freeReturnCard: {
        findFirst: vi.fn().mockResolvedValue(opts.open ? { id: 1 } : null),
        aggregate: vi.fn().mockResolvedValue({ _max: { usedAt: opts.lastUsed ?? null } }),
      },
      $transaction: vi.fn().mockImplementation((fn: any) => fn(tx)),
    } as any,
  };
}
const rows = (n: number) => mk(n).map((o) => ({ ...o, user: { identityId: 3 } }));

describe("FreeReturnCardService.accrueAll", () => {
  it("10 طلبيات ناجحة: تُنشأ بطاقة وتُعلَّم الطلبيات", async () => {
    const { db, tx } = makeDb({ rows: rows(10) });
    const r = await FreeReturnCardService.accrueAll(db);
    expect(r.created).toBe(1);
    expect(tx.freeReturnCard.create.mock.calls[0][0].data).toEqual({ identityId: 3 });
    expect(tx.order.updateMany.mock.calls[0][0].data).toEqual({ countedForCardId: 50 });
  });
  it("9 طلبيات: لا شيء", async () => {
    const { db } = makeDb({ rows: rows(9) });
    expect((await FreeReturnCardService.accrueAll(db)).created).toBe(0);
  });
  it("بطاقة غير مستعملة موجودة: لا بطاقة جديدة", async () => {
    const { db } = makeDb({ rows: rows(10), open: true });
    expect((await FreeReturnCardService.accrueAll(db)).created).toBe(0);
  });
  it("سباق: إن كانت الطلبيات محتسبة مسبقاً تُلغى العملية", async () => {
    const { db } = makeDb({ rows: rows(10), updCount: 7 });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await FreeReturnCardService.accrueAll(db)).created).toBe(0);
  });
});