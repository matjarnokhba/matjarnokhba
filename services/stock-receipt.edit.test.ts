import { describe, it, expect, vi } from "vitest";

vi.mock("./pool.service", () => ({
  PoolService: { syncInventoryToPool: vi.fn() },
}));

import { StockReceiptService, StockReceiptError } from "./stock-receipt.service";
import { createFakeDb } from "./testing/fake-db";

const SELLER = 1;
const OWNER = 10;
const STAFF = 11;
const OTHER_STAFF = 12;

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

async function pending(tx: any, items = [{ variantId: 1, quantity: 5 }], extra: Record<string, unknown> = {}) {
  const r = await StockReceiptService.createReceipt(tx, {
    ...base, enteredByUserId: STAFF, actorIsOwner: false, items, ...extra,
  } as any);
  return r.receiptId;
}

const edit = (receiptId: number, rest: Record<string, unknown>, actorUserId = STAFF, sellerId = SELLER) =>
  ({ receiptId, sellerId, actorUserId, ...rest }) as any;

describe("updatePendingReceipt", () => {
  it("staff edits quantity and unit cost; stock is untouched", async () => {
    const { tx, db, qty } = setup();
    const id = await pending(tx);
    const itemId = db.receiptItems[0].id;
    const r = await StockReceiptService.updatePendingReceipt(tx, edit(id, { items: [{ itemId, quantity: 7, unitCost: 12.5 }] }));
    expect(r.status).toBe("PENDING");
    expect(db.receiptItems[0].quantity).toBe(7);
    expect(db.receiptItems[0].unitCost).toBe(12.5);
    expect(db.receipts[0].status).toBe("PENDING");
    expect(db.receipts[0].updatedAt).toBeInstanceOf(Date);
    expect(qty(1)).toBe(5);
    expect(db.movements.length).toBe(0);
  });

  it("edits source details, total cost and invoice", async () => {
    const { tx, db } = setup();
    const id = await pending(tx);
    await StockReceiptService.updatePendingReceipt(
      tx,
      edit(id, {
        sourceName: "مورد جديد",
        sourcePhone: "0600000000",
        totalCost: 120.456,
        invoiceUrl: "https://example.com/i.pdf",
        invoiceName: "inv.pdf",
      })
    );
    expect(db.receipts[0].sourceName).toBe("مورد جديد");
    expect(db.receipts[0].sourcePhone).toBe("0600000000");
    expect(db.receipts[0].totalCost).toBe(120.46);
    expect(db.receipts[0].invoiceUrl).toBe("https://example.com/i.pdf");
    expect(db.receipts[0].status).toBe("PENDING");
  });

  it("approval adds the edited quantity, not the original", async () => {
    const { tx, qty } = setup();
    const id = await pending(tx);
    const itemId = (tx as any) && (await tx.stockReceipt.findFirst({ where: { id }, include: { items: true } })).items[0].id;
    await StockReceiptService.updatePendingReceipt(tx, edit(id, { items: [{ itemId, quantity: 8 }] }));
    const r = await StockReceiptService.approveReceipt(tx, { receiptId: id, sellerId: SELLER, decidedByUserId: OWNER });
    expect(r.added).toBe(8);
    expect(qty(1)).toBe(13);
  });

  it("refuses editing after approval", async () => {
    const { tx, db, qty } = setup();
    const id = await pending(tx);
    const itemId = db.receiptItems[0].id;
    await StockReceiptService.approveReceipt(tx, { receiptId: id, sellerId: SELLER, decidedByUserId: OWNER });
    expect(await code(StockReceiptService.updatePendingReceipt(tx, edit(id, { items: [{ itemId, quantity: 99 }] })))).toBe("CONFLICT");
    expect(db.receiptItems[0].quantity).toBe(5);
    expect(qty(1)).toBe(10);
  });

  it("refuses editing after rejection", async () => {
    const { tx, db } = setup();
    const id = await pending(tx);
    const itemId = db.receiptItems[0].id;
    await StockReceiptService.rejectReceipt(tx, { receiptId: id, sellerId: SELLER, decidedByUserId: OWNER, reason: "سبب الرفض" });
    expect(await code(StockReceiptService.updatePendingReceipt(tx, edit(id, { items: [{ itemId, quantity: 9 }] })))).toBe("CONFLICT");
    expect(db.receiptItems[0].quantity).toBe(5);
  });

  it("another staff member cannot edit the request", async () => {
    const { tx, db } = setup();
    const id = await pending(tx);
    const itemId = db.receiptItems[0].id;
    expect(await code(StockReceiptService.updatePendingReceipt(tx, edit(id, { items: [{ itemId, quantity: 9 }] }, OTHER_STAFF)))).toBe("CONFLICT");
    expect(db.receiptItems[0].quantity).toBe(5);
  });

  it("a request of another seller is NOT_FOUND", async () => {
    const { tx, db } = setup();
    const r = await StockReceiptService.createReceipt(tx, {
      sellerId: 2, sourceType: "SUPPLIER", sourceName: "x", enteredByUserId: STAFF, actorIsOwner: false,
      items: [{ variantId: 3, quantity: 2 }],
    });
    const itemId = db.receiptItems[0].id;
    expect(await code(StockReceiptService.updatePendingReceipt(tx, edit(r.receiptId, { items: [{ itemId, quantity: 9 }] })))).toBe("NOT_FOUND");
    expect(db.receiptItems[0].quantity).toBe(2);
  });

  it("a missing request is NOT_FOUND", async () => {
    const { tx } = setup();
    expect(await code(StockReceiptService.updatePendingReceipt(tx, edit(999, { sourceName: "x" })))).toBe("NOT_FOUND");
  });

  it("refuses an item that belongs to another request", async () => {
    const { tx, db } = setup();
    const a = await pending(tx, [{ variantId: 1, quantity: 5 }]);
    await pending(tx, [{ variantId: 2, quantity: 3 }]);
    const foreignItemId = db.receiptItems[1].id;
    expect(await code(StockReceiptService.updatePendingReceipt(tx, edit(a, { items: [{ itemId: foreignItemId, quantity: 1 }] })))).toBe("VALIDATION");
    expect(db.receiptItems[1].quantity).toBe(3);
  });

  it("refuses zeroing every item", async () => {
    const { tx, db } = setup();
    const id = await pending(tx);
    const itemId = db.receiptItems[0].id;
    expect(await code(StockReceiptService.updatePendingReceipt(tx, edit(id, { items: [{ itemId, quantity: 0 }] })))).toBe("VALIDATION");
    expect(db.receiptItems[0].quantity).toBe(5);
  });

  it("allows cancelling one option; approval then adds only the rest", async () => {
    const { tx, db, qty } = setup();
    const id = await pending(tx, [{ variantId: 1, quantity: 5 }, { variantId: 2, quantity: 3 }]);
    const first = db.receiptItems.find((i) => i.variantId === 1)!.id;
    await StockReceiptService.updatePendingReceipt(tx, edit(id, { items: [{ itemId: first, quantity: 0 }] }));
    const r = await StockReceiptService.approveReceipt(tx, { receiptId: id, sellerId: SELLER, decidedByUserId: OWNER });
    expect(r.added).toBe(3);
    expect(qty(1)).toBe(5);
    expect(qty(2)).toBe(3);
  });

  it("refuses an edit with no changes", async () => {
    const { tx, db } = setup();
    const id = await pending(tx);
    const itemId = db.receiptItems[0].id;
    expect(await code(StockReceiptService.updatePendingReceipt(tx, edit(id, { items: [{ itemId, quantity: 5 }] })))).toBe("VALIDATION");
  });

  it("source OTHER needs details", async () => {
    const { tx, db } = setup();
    const id = await pending(tx);
    expect(await code(StockReceiptService.updatePendingReceipt(tx, edit(id, { sourceType: "OTHER", sourceName: null, sourceNote: null })))).toBe("VALIDATION");
    expect(db.receipts[0].sourceType).toBe("SUPPLIER");
  });

  it("refuses invalid quantities", async () => {
    const { tx, db } = setup();
    const id = await pending(tx);
    const itemId = db.receiptItems[0].id;
    expect(await code(StockReceiptService.updatePendingReceipt(tx, edit(id, { items: [{ itemId, quantity: -1 }] })))).toBe("VALIDATION");
    expect(await code(StockReceiptService.updatePendingReceipt(tx, edit(id, { items: [{ itemId, quantity: 1.5 }] })))).toBe("VALIDATION");
    expect(db.receiptItems[0].quantity).toBe(5);
  });

  it("a platform-transfer request cannot change its source type", async () => {
    const { tx, db } = setup();
    const id = await pending(tx, [{ variantId: 1, quantity: 5 }], {
      sourceType: "PLATFORM_TRANSFER", externalRefType: "WHOLESALE_TRANSFER", externalRefId: 5,
    });
    expect(await code(StockReceiptService.updatePendingReceipt(tx, edit(id, { sourceType: "SUPPLIER" })))).toBe("VALIDATION");
    expect(db.receipts[0].sourceType).toBe("PLATFORM_TRANSFER");
  });

  it("an edit that lands during approval aborts the approval and adds no stock", async () => {
    const { tx, db, qty } = setup();
    const id = await pending(tx);
    const original = tx.stockReceipt.updateMany;
    let injected = false;
    tx.stockReceipt.updateMany = async (args: any) => {
      if (!injected && args.data?.status === "APPROVED") {
        injected = true;
        db.receiptItems[0].quantity = 9; // تعديل الموظف يُثبَّت بعد قراءة الاعتماد وقبل مطالبته
      }
      return original(args);
    };
    expect(await code(StockReceiptService.approveReceipt(tx, { receiptId: id, sellerId: SELLER, decidedByUserId: OWNER }))).toBe("CONFLICT");
    expect(qty(1)).toBe(5);
    expect(db.movements.length).toBe(0);
  });
});