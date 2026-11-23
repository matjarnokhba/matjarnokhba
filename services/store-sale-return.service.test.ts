import { describe, it, expect, vi } from "vitest";

vi.mock("./pool.service", () => ({
  PoolService: { syncInventoryToPool: vi.fn() },
}));

import {
  StoreSaleReturnService,
  StoreSaleReturnError,
  parseReturnWindowDays,
} from "./store-sale-return.service";
import { createFakeDb } from "./testing/fake-db";

const SELLER = 1;
const STAFF = 11;
const SALE_AT = new Date("2026-11-20T10:00:00Z");
const DAY = 86400000;

function setup(windowDays = 7) {
  return createFakeDb({
    variants: [
      { id: 1, sellerId: SELLER, productId: 100 },
      { id: 2, sellerId: SELLER, productId: 100 },
    ],
    inventory: [
      { variantId: 1, quantity: 10 },
      { variantId: 2, quantity: 4 },
    ],
    sellers: [{ id: SELLER, posReturnWindowDays: windowDays }],
    sales: [{ id: 5, sellerId: SELLER, receiptNumber: "POS-TEST-1", createdAt: SALE_AT }],
    // السلعة بيعت بـ 90 (خصم من 100)
    saleItems: [
      { id: 50, storeSaleId: 5, variantId: 1, quantity: 3, unitPrice: 90 },
      { id: 51, storeSaleId: 5, variantId: 2, quantity: 1, unitPrice: 50 },
    ],
  });
}

const at = (days: number) => new Date(SALE_AT.getTime() + days * DAY);
const base = { sellerId: SELLER, storeSaleId: 5, processedByUserId: STAFF, now: at(2) };

async function code(p: Promise<unknown>) {
  try {
    await p;
    return null;
  } catch (e: any) {
    return e instanceof StoreSaleReturnError ? e.code : "OTHER:" + e.message;
  }
}

describe("resellable return", () => {
  it("restocks, refunds at the price actually paid, and logs who did it", async () => {
    const { tx, db, qty } = setup();
    const r = await StoreSaleReturnService.createReturn(tx, {
      ...base, items: [{ storeSaleItemId: 50, quantity: 2, condition: "RESELLABLE" }],
    });
    expect(r.refundTotal).toBe(180); // 2 x 90 (not the list price 100)
    expect(qty(1)).toBe(12);
    const mv = db.movements[0];
    expect(mv.type).toBe("RETURN");
    expect(mv.referenceType).toBe("STORE_SALE_RETURN");
    expect(mv.performedById).toBe(STAFF);
    expect(mv.beforeQuantity).toBe(10);
    expect(mv.afterQuantity).toBe(12);
    expect(db.sales[0].receiptNumber).toBe("POS-TEST-1"); // original sale untouched
    expect(db.saleItems[0].quantity).toBe(3);
    expect(db.locks).toContain(5);
  });
});

describe("defective return", () => {
  it("goes to defective stock, never to sellable stock, and still refunds", async () => {
    const { tx, db, qty, defective } = setup();
    const r = await StoreSaleReturnService.createReturn(tx, {
      ...base, items: [{ storeSaleItemId: 50, quantity: 1, condition: "DEFECTIVE", note: "خياطة ممزقة" }],
    });
    expect(r.refundTotal).toBe(90);
    expect(qty(1)).toBe(10);
    expect(defective(1)).toBe(1);
    expect(db.movements[0].stockBucket).toBe("DEFECTIVE");
  });

  it("requires a description of the defect", async () => {
    const { tx } = setup();
    expect(await code(StoreSaleReturnService.createReturn(tx, {
      ...base, items: [{ storeSaleItemId: 50, quantity: 1, condition: "DEFECTIVE" }],
    }))).toBe("VALIDATION");
  });

  it("one item can be split between resellable and defective", async () => {
    const { tx, qty, defective } = setup();
    const r = await StoreSaleReturnService.createReturn(tx, {
      ...base,
      items: [
        { storeSaleItemId: 50, quantity: 1, condition: "RESELLABLE" },
        { storeSaleItemId: 50, quantity: 1, condition: "DEFECTIVE", note: "لا يعمل" },
      ],
    });
    expect(r.refundTotal).toBe(180);
    expect(qty(1)).toBe(11);
    expect(defective(1)).toBe(1);
  });
});

describe("quantity limits", () => {
  it("cannot return more than was sold, across several returns", async () => {
    const { tx, qty } = setup();
    const ret = (quantity: number) =>
      StoreSaleReturnService.createReturn(tx, {
        ...base, items: [{ storeSaleItemId: 50, quantity, condition: "RESELLABLE" }],
      });
    await ret(2);
    expect(await code(ret(2))).toBe("VALIDATION"); // only 1 left
    expect(qty(1)).toBe(12);
    expect(await code(ret(1))).toBeNull();
    expect(await code(ret(1))).toBe("VALIDATION"); // fully returned
    expect(qty(1)).toBe(13);
  });

  it("cannot exceed the sold quantity inside one request either", async () => {
    const { tx, qty } = setup();
    const res = StoreSaleReturnService.createReturn(tx, {
      ...base,
      items: [
        { storeSaleItemId: 50, quantity: 2, condition: "RESELLABLE" },
        { storeSaleItemId: 50, quantity: 2, condition: "DEFECTIVE", note: "كسر" },
      ],
    });
    expect(await code(res)).toBe("VALIDATION");
    expect(qty(1)).toBe(10);
  });
});

describe("return window", () => {
  const ret = (tx: any, now: Date) =>
    StoreSaleReturnService.createReturn(tx, {
      ...base, now, items: [{ storeSaleItemId: 51, quantity: 1, condition: "RESELLABLE" }],
    });

  it("default 7 days: allowed at day 6, refused at day 8", async () => {
    const a = setup(7);
    expect(await code(ret(a.tx, at(6)))).toBeNull();
    const b = setup(7);
    expect(await code(ret(b.tx, at(8)))).toBe("VALIDATION");
  });

  it("merchant window of 3 days is respected", async () => {
    const a = setup(3);
    expect(await code(ret(a.tx, at(2)))).toBeNull();
    const b = setup(3);
    expect(await code(ret(b.tx, at(4)))).toBe("VALIDATION");
  });

  it("parseReturnWindowDays accepts only 3..7", () => {
    expect(parseReturnWindowDays(3)).toBe(3);
    expect(parseReturnWindowDays(7)).toBe(7);
    expect(parseReturnWindowDays(2)).toBeNull();
    expect(parseReturnWindowDays(8)).toBeNull();
    expect(parseReturnWindowDays(4.5)).toBeNull();
    expect(parseReturnWindowDays("5")).toBeNull();
  });
});

describe("ownership and input checks", () => {
  it("another seller cannot return this receipt", async () => {
    const { tx, qty } = setup();
    expect(await code(StoreSaleReturnService.createReturn(tx, {
      ...base, sellerId: 2, items: [{ storeSaleItemId: 50, quantity: 1, condition: "RESELLABLE" }],
    }))).toBe("NOT_FOUND");
    expect(qty(1)).toBe(10);
  });

  it("rejects items from another receipt and bad quantities", async () => {
    const { tx } = setup();
    const mk = (items: any) => StoreSaleReturnService.createReturn(tx, { ...base, items });
    expect(await code(mk([{ storeSaleItemId: 999, quantity: 1, condition: "RESELLABLE" }]))).toBe("VALIDATION");
    expect(await code(mk([{ storeSaleItemId: 50, quantity: 0, condition: "RESELLABLE" }]))).toBe("VALIDATION");
    expect(await code(mk([{ storeSaleItemId: 50, quantity: 1.5, condition: "RESELLABLE" }]))).toBe("VALIDATION");
    expect(await code(mk([{ storeSaleItemId: 50, quantity: 1, condition: "BROKEN" }]))).toBe("VALIDATION");
    expect(await code(mk([]))).toBe("VALIDATION");
  });
});