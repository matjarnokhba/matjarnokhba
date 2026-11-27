import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { decideReturnShipping, isSellerFault } from "../lib/return-policy";
import { WalletService } from "./wallet.service";

describe("decideReturnShipping", () => {
  it("عيب/خطأ: التاجر يدفع والزبون 0 والبطاقة لا تُستهلك", () => {
    for (const r of ["DEFECTIVE", "WRONG_ITEM", "MISSING_ITEM", "LOST"]) {
      expect(isSellerFault(r)).toBe(true);
      expect(decideReturnShipping({ reasonType: r, hasCard: true, fee: 15 })).toEqual({ payer: "SELLER", fee: 15, customerPays: 0 });
    }
  });
  it("تغيير رأي ببطاقة: المنصة تتحمل", () => {
    expect(decideReturnShipping({ reasonType: "CHANGED_MIND", hasCard: true, fee: 15 })).toEqual({ payer: "PLATFORM", fee: 15, customerPays: 0 });
  });
  it("تغيير رأي بلا بطاقة: الزبون يدفع", () => {
    expect(decideReturnShipping({ reasonType: "CHANGED_MIND", hasCard: false, fee: 15 })).toEqual({ payer: "CUSTOMER", fee: 15, customerPays: 15 });
  });
});

function makeTx(dup = false) {
  return {
    wallet: { upsert: vi.fn().mockResolvedValue({ id: 9 }) },
    walletTransactionUnified: { create: vi.fn().mockResolvedValue({}) },
    walletTransaction: {
      findUnique: vi.fn().mockResolvedValue(dup ? { id: 1 } : null),
      create: vi.fn().mockResolvedValue({}),
    },
    seller: { update: vi.fn().mockResolvedValue({ walletBalance: 35, userId: 4 }) },
    notification: { create: vi.fn().mockResolvedValue({}) },
  } as any;
}

describe("WalletService.settleReturnShipping", () => {
  it("التاجر: يُخصم من رصيده بمفتاح فريد ويصل المستودع", async () => {
    const tx = makeTx();
    await WalletService.settleReturnShipping(tx, { warehouseId: 1, returnId: 5, orderNumber: "O-5", sellerId: 2, payer: "SELLER", fee: 15 });
    expect(tx.seller.update.mock.calls[0][0].data.walletBalance).toEqual({ decrement: 15 });
    const d = tx.walletTransaction.create.mock.calls[0][0].data;
    expect(d.idempotencyKey).toBe("retship:5");
    expect(d.balanceBefore).toBe(50);
    expect(tx.wallet.upsert.mock.calls[0][0].update.balance).toEqual({ increment: 15 });
  });
  it("التاجر: تكرار نفس الإرجاع لا يخصم مرتين", async () => {
    const tx = makeTx(true);
    await WalletService.settleReturnShipping(tx, { warehouseId: 1, returnId: 5, orderNumber: "O-5", sellerId: 2, payer: "SELLER", fee: 15 });
    expect(tx.seller.update).not.toHaveBeenCalled();
  });
  it("الزبون: لا يمس أرصدة التاجر أو المنصة", async () => {
    const tx = makeTx();
    await WalletService.settleReturnShipping(tx, { warehouseId: 1, returnId: 6, orderNumber: "O-6", sellerId: 2, payer: "CUSTOMER", fee: 15 });
    expect(tx.seller.update).not.toHaveBeenCalled();
    expect(tx.wallet.upsert).toHaveBeenCalledTimes(1);
  });
  it("المنصة: تُخصم من محفظتها", async () => {
    const tx = makeTx();
    await WalletService.settleReturnShipping(tx, { warehouseId: 1, returnId: 7, orderNumber: "O-7", sellerId: 2, payer: "PLATFORM", fee: 15 });
    expect(tx.wallet.upsert).toHaveBeenCalledTimes(2);
    expect(tx.wallet.upsert.mock.calls[1][0].update.balance).toEqual({ decrement: 15 });
    expect(tx.seller.update).not.toHaveBeenCalled();
  });
  it("NONE أو رسوم صفر: لا شيء", async () => {
    const tx = makeTx();
    const r: any = await WalletService.settleReturnShipping(tx, { warehouseId: 1, returnId: 8, orderNumber: "O-8", sellerId: 2, payer: "NONE", fee: 15 });
    expect(r.skipped).toBe(true);
    expect(tx.wallet.upsert).not.toHaveBeenCalled();
  });
});