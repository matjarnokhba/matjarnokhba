import { describe, it, expect, vi } from "vitest";

vi.mock("./pool.service", () => ({
  PoolService: { syncInventoryToPool: vi.fn() },
}));

import { StockReceiptService, StockReceiptError } from "./stock-receipt.service";
import { createFakeDb } from "./testing/fake-db";

const SELLER = 1;
const OWNER = 10;
const STAFF = 11;

function setup() {
  return createFakeDb({
    variants: [
      { id: 1, sellerId: SELLER, productId: 100 },
      { id: 2, sellerId: SELLER, productId: 100 },
      { id: 3, sellerId: 2, productId: 200 },
    ],
    inventory: [
      { variantId: 1, quantity: 5 },
      { variantId: 2, quantity: 0 },
      { variantId: 3, quantity: 7 },
    ],
  });
}

const base = { sellerId: SELLER, sourceType: "SUPPLIER" as const, sourceName: "مورد تجريبي" };

async function code(p: Promise<unknown>) {
  try {
    await p;
    return null;
  } catch (e: any) {
    return e instanceof StockReceiptError ? e.code : "OTHER:" + e.message;
  }
}

describe("createReceipt", () => {
  it("staff entry stays PENDING and does not touch stock", async () => {
    const { tx, db, qty } = setup();
    const r = await StockReceiptService.createReceipt(tx, {
      ...base, enteredByUserId: STAFF, actorIsOwner: false, items: [{ variantId: 1, quantity: 5 }],
    });
    expect(r.status).toBe("PENDING");
    expect(qty(1)).toBe(5);
    expect(db.movements.length).toBe(0);
    expect(db.receipts[0].receivedByUserId).toBe(STAFF);
    expect(db.receipts[0].enteredByUserId).toBe(STAFF);
  });

  it("owner entry is approved immediately and logged", async () => {
    const { tx, db, qty } = setup();
    const r = await StockReceiptService.createReceipt(tx, {
      ...base, enteredByUserId: OWNER, actorIsOwner: true, items: [{ variantId: 1, quantity: 5 }],
    });
    expect(r.status).toBe("APPROVED");
    expect(qty(1)).toBe(10);
    expect(db.movements.length).toBe(1);
    const mv = db.movements[0];
    expect(mv.type).toBe("STOCK_IN");
    expect(mv.referenceType).toBe("STOCK_RECEIPT");
    expect(mv.performedById).toBe(OWNER);
    expect(mv.beforeQuantity).toBe(5);
    expect(mv.afterQuantity).toBe(10);
    expect(mv.receiptItemId).toBeDefined();
  });

  it("merges duplicate variants in one receipt", async () => {
    const { tx, db } = setup();
    await StockReceiptService.createReceipt(tx, {
      ...base, enteredByUserId: STAFF, actorIsOwner: false,
      items: [{ variantId: 1, quantity: 2 }, { variantId: 1, quantity: 3 }],
    });
    expect(db.receiptItems.length).toBe(1);
    expect(db.receiptItems[0].quantity).toBe(5);
  });

  it("rejects invalid input", async () => {
    const { tx } = setup();
    const mk = (items: any, extra: any = {}) =>
      StockReceiptService.createReceipt(tx, { ...base, enteredByUserId: STAFF, actorIsOwner: false, items, ...extra });
    expect(await code(mk([]))).toBe("VALIDATION");
    expect(await code(mk([{ variantId: 1, quantity: 0 }]))).toBe("VALIDATION");
    expect(await code(mk([{ variantId: 1, quantity: -3 }]))).toBe("VALIDATION");
    expect(await code(mk([{ variantId: 1, quantity: 1.5 }]))).toBe("VALIDATION");
    expect(await code(mk([{ variantId: 3, quantity: 1 }]))).toBe("VALIDATION"); // variant of another seller
    expect(await code(mk([{ variantId: 99, quantity: 1 }]))).toBe("VALIDATION");
    expect(await code(mk([{ variantId: 1, quantity: 1 }], { sourceType: "OTHER", sourceName: "" }))).toBe("VALIDATION");
    expect(await code(mk([{ variantId: 1, quantity: 1 }], { externalRefType: "TRANSFER" }))).toBe("VALIDATION");
  });
});

describe("duplicate prevention", () => {
  it("same external reference twice is a CONFLICT", async () => {
    const { tx } = setup();
    const input = {
      ...base, sourceType: "OTHER_STORE" as const, enteredByUserId: STAFF, actorIsOwner: false,
      externalRefType: "WHOLESALE_ORDER", externalRefId: 7, items: [{ variantId: 1, quantity: 2 }],
    };
    await StockReceiptService.createReceipt(tx, input);
    expect(await code(StockReceiptService.createReceipt(tx, input))).toBe("CONFLICT");
  });

  it("quantity already added automatically by a TRANSFER cannot be entered again", async () => {
    const { tx, db } = setup();
    db.movements.push({
      id: 900, inventoryId: db.inventory[0].id, type: "TRANSFER_IN",
      referenceType: "TRANSFER", referenceId: BigInt(55),
    });
    const input = (id: number) => ({
      ...base, sourceType: "PLATFORM_TRANSFER" as const, enteredByUserId: STAFF, actorIsOwner: false,
      externalRefType: "TRANSFER", externalRefId: id, items: [{ variantId: 1, quantity: 5 }],
    });
    expect(await code(StockReceiptService.createReceipt(tx, input(55)))).toBe("CONFLICT");
    expect(await code(StockReceiptService.createReceipt(tx, input(56)))).toBeNull();
  });

  it("a genuinely new purchase of the same product and quantity is NOT blocked", async () => {
    const { tx } = setup();
    const input = { ...base, enteredByUserId: STAFF, actorIsOwner: false, items: [{ variantId: 1, quantity: 5 }] };
    expect(await code(StockReceiptService.createReceipt(tx, input))).toBeNull();
    expect(await code(StockReceiptService.createReceipt(tx, input))).toBeNull();
  });
});

describe("approveReceipt", () => {
  async function pending(tx: any, qty = 5) {
    const r = await StockReceiptService.createReceipt(tx, {
      ...base, enteredByUserId: STAFF, actorIsOwner: false, items: [{ variantId: 1, quantity: qty }],
    });
    return r.receiptId;
  }

  it("adds stock once and records who approved", async () => {
    const { tx, db, qty } = setup();
    const id = await pending(tx);
    const r = await StockReceiptService.approveReceipt(tx, { receiptId: id, sellerId: SELLER, decidedByUserId: OWNER });
    expect(r.added).toBe(5);
    expect(qty(1)).toBe(10);
    expect(db.receipts[0].status).toBe("APPROVED");
    expect(db.receipts[0].decidedByUserId).toBe(OWNER);
    expect(db.movements[0].performedById).toBe(OWNER);
  });

  it("approving twice is a CONFLICT and stock is added once", async () => {
    const { tx, qty } = setup();
    const id = await pending(tx);
    const a = { receiptId: id, sellerId: SELLER, decidedByUserId: OWNER };
    await StockReceiptService.approveReceipt(tx, a);
    expect(await code(StockReceiptService.approveReceipt(tx, a))).toBe("CONFLICT");
    expect(qty(1)).toBe(10);
  });

  it("two simultaneous approvals add stock only once", async () => {
    const { tx, qty } = setup();
    const id = await pending(tx);
    const a = { receiptId: id, sellerId: SELLER, decidedByUserId: OWNER };
    const res = await Promise.all([
      code(StockReceiptService.approveReceipt(tx, a)),
      code(StockReceiptService.approveReceipt(tx, a)),
    ]);
    expect(res.filter((x) => x === null).length).toBe(1);
    expect(res).toContain("CONFLICT");
    expect(qty(1)).toBe(10);
  });

  it("adjusted quantity requires a reason and is recorded", async () => {
    const { tx, db, qty } = setup();
    const id = await pending(tx, 5);
    const itemId = db.receiptItems[0].id;
    const noReason = { receiptId: id, sellerId: SELLER, decidedByUserId: OWNER, adjustments: [{ itemId, approvedQuantity: 3 }] };
    expect(await code(StockReceiptService.approveReceipt(tx, noReason))).toBe("VALIDATION");
    expect(db.receipts[0].status).toBe("PENDING");
    expect(qty(1)).toBe(5);

    const ok = { ...noReason, adjustments: [{ itemId, approvedQuantity: 3, reason: "خطأ في كتابة الكمية" }] };
    const r = await StockReceiptService.approveReceipt(tx, ok);
    expect(r.added).toBe(3);
    expect(qty(1)).toBe(8);
    expect(db.receiptItems[0].approvedQuantity).toBe(3);
    expect(db.receiptItems[0].adjustmentReason).toBe("خطأ في كتابة الكمية");
  });

  it("all-zero approval is refused and changes nothing", async () => {
    const { tx, db, qty } = setup();
    const id = await pending(tx);
    const itemId = db.receiptItems[0].id;
    const res = StockReceiptService.approveReceipt(tx, {
      receiptId: id, sellerId: SELLER, decidedByUserId: OWNER,
      adjustments: [{ itemId, approvedQuantity: 0, reason: "لم تصل السلعة" }],
    });
    expect(await code(res)).toBe("VALIDATION");
    expect(db.receipts[0].status).toBe("PENDING");
    expect(qty(1)).toBe(5);
  });

  it("another seller cannot approve", async () => {
    const { tx, qty } = setup();
    const id = await pending(tx);
    expect(await code(StockReceiptService.approveReceipt(tx, { receiptId: id, sellerId: 2, decidedByUserId: 99 }))).toBe("NOT_FOUND");
    expect(qty(1)).toBe(5);
  });
});

describe("rejectReceipt", () => {
  it("rejects with a reason, keeps the record, never touches stock", async () => {
    const { tx, db, qty } = setup();
    const r = await StockReceiptService.createReceipt(tx, {
      ...base, enteredByUserId: STAFF, actorIsOwner: false, items: [{ variantId: 1, quantity: 5 }],
    });
    expect(await code(StockReceiptService.rejectReceipt(tx, { receiptId: r.receiptId, sellerId: SELLER, decidedByUserId: OWNER, reason: " " }))).toBe("VALIDATION");
    await StockReceiptService.rejectReceipt(tx, { receiptId: r.receiptId, sellerId: SELLER, decidedByUserId: OWNER, reason: "الفاتورة غير واضحة" });
    expect(db.receipts[0].status).toBe("REJECTED");
    expect(db.receipts[0].rejectionReason).toBe("الفاتورة غير واضحة");
    expect(qty(1)).toBe(5);
    expect(db.movements.length).toBe(0);
    // cannot approve or reject again
    expect(await code(StockReceiptService.approveReceipt(tx, { receiptId: r.receiptId, sellerId: SELLER, decidedByUserId: OWNER }))).toBe("CONFLICT");
    expect(await code(StockReceiptService.rejectReceipt(tx, { receiptId: r.receiptId, sellerId: SELLER, decidedByUserId: OWNER, reason: "مرة ثانية" }))).toBe("CONFLICT");
  });
});