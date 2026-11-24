import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { computeClawback } from "../lib/return-clawback";
import { WalletService } from "./wallet.service";

describe("computeClawback", () => {
  const base = { commission: 20, sellerPayout: 180, refundedCommission: 0, prevNet: 0, isFull: false };
  it("إرجاع نصف القيمة يعكس نصف الصافي والعمولة", () => {
    const r = computeClawback({ ...base, items: [{ unitPrice: 100, qty: 1, subsidyShare: 0 }] });
    expect(r.netBack).toBe(90);
    expect(r.commissionBack).toBe(10);
  });
  it("إرجاع كامل يعكس كل الباقي بالضبط", () => {
    const r = computeClawback({ ...base, isFull: true, prevNet: 90, refundedCommission: 10, items: [{ unitPrice: 100, qty: 1, subsidyShare: 0 }] });
    expect(r.netBack).toBe(90);
    expect(r.commissionBack).toBe(10);
  });
  it("لا يتجاوز المتبقي أبداً", () => {
    const r = computeClawback({ ...base, prevNet: 170, refundedCommission: 19, items: [{ unitPrice: 200, qty: 1, subsidyShare: 0 }] });
    expect(r.netBack).toBe(10);
    expect(r.commissionBack).toBe(1);
  });
  it("قطعة من عرض: تُحسب بسعر القائمة (سعر العرض + الدعم)", () => {
    const r = computeClawback({ ...base, isFull: true, items: [{ unitPrice: 80, qty: 2, subsidyShare: 40 }] });
    expect(r.returnedValue).toBe(200);
    expect(r.subsidyBack).toBe(40);
    expect(r.netBack).toBe(180);
  });
});

function makeTx(opts: { dup?: boolean; lines?: any[]; balanceAfter?: number } = {}) {
  return {
    walletTransaction: {
      findUnique: vi.fn().mockResolvedValue(opts.dup ? { id: 1 } : null),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
      create: vi.fn().mockResolvedValue({}),
    },
    flashSaleOrderLine: {
      findMany: vi.fn().mockResolvedValue(opts.lines ?? []),
      updateMany: vi.fn().mockResolvedValue({}),
    },
    seller: { update: vi.fn().mockResolvedValue({ walletBalance: opts.balanceAfter ?? 50, userId: 3 }) },
    order: { update: vi.fn().mockResolvedValue({}) },
    wallet: { upsert: vi.fn().mockResolvedValue({ id: 99 }) },
    walletTransactionUnified: { create: vi.fn().mockResolvedValue({}) },
    notification: { create: vi.fn().mockResolvedValue({}) },
  } as any;
}
const order = { id: 7, orderNumber: "ORD-7", sellerId: 5, commission: 20, sellerPayout: 180, refundedCommission: 0 };

describe("WalletService.clawbackReturn", () => {
  it("إرجاع جزئي: يخصم الصافي ويسجل الحركة بمفتاح فريد وتُسترد العمولة", async () => {
    const tx = makeTx();
    const r: any = await WalletService.clawbackReturn(tx, {
      returnId: 5, isFull: false, order,
      items: [{ orderItemId: 1, qty: 1, orderItemQty: 2, unitPrice: 100 }],
    });
    expect(r.netBack).toBe(90);
    expect(tx.seller.update.mock.calls[0][0].data.walletBalance).toEqual({ decrement: 90 });
    const d = tx.walletTransaction.create.mock.calls[0][0].data;
    expect(d.idempotencyKey).toBe("return:5");
    expect(d.type).toBe("REFUND_DEDUCTION");
    expect(d.orderId).toBe(7);
    expect(tx.order.update.mock.calls[0][0].data).toEqual({ refundedCommission: { increment: 10 } });
    expect(tx.wallet.upsert.mock.calls[0][0].update.balance).toEqual({ decrement: 10 });
  });
  it("عرض بدعم منصة: المنصة تسترد الدعم ويُعلَّم البند معكوساً", async () => {
    const tx = makeTx({ lines: [{ id: 3, orderItemId: 1, quantity: 2, platformSubsidy: 40 }] });
    await WalletService.clawbackReturn(tx, {
      returnId: 6, isFull: true, order,
      items: [{ orderItemId: 1, qty: 2, orderItemQty: 2, unitPrice: 80 }],
    });
    expect(tx.seller.update.mock.calls[0][0].data.walletBalance).toEqual({ decrement: 180 });
    expect(tx.wallet.upsert.mock.calls[0][0].update.balance).toEqual({ decrement: -20 });
    expect(tx.flashSaleOrderLine.updateMany.mock.calls[0][0].data.reversedAt).toBeInstanceOf(Date);
  });
  it("تكرار نفس الإرجاع لا يخصم مرتين", async () => {
    const tx = makeTx({ dup: true });
    const r: any = await WalletService.clawbackReturn(tx, { returnId: 5, isFull: false, order, items: [{ orderItemId: 1, qty: 1, orderItemQty: 2, unitPrice: 100 }] });
    expect(r.skipped).toBe("duplicate");
    expect(tx.seller.update).not.toHaveBeenCalled();
  });
  it("طلب بلا سجل أرباح (قديم) لا يُخصم منه شيء", async () => {
    const tx = makeTx();
    const r: any = await WalletService.clawbackReturn(tx, {
      returnId: 5, isFull: true, order: { ...order, sellerPayout: null, commission: null },
      items: [{ orderItemId: 1, qty: 1, orderItemQty: 1, unitPrice: 100 }],
    });
    expect(r.skipped).toBe("no-earning-record");
    expect(tx.seller.update).not.toHaveBeenCalled();
  });
  it("الرصيد يصير سالباً عند عدم الكفاية (دين)", async () => {
    const tx = makeTx({ balanceAfter: -40 });
    await WalletService.clawbackReturn(tx, { returnId: 8, isFull: true, order, items: [{ orderItemId: 1, qty: 1, orderItemQty: 1, unitPrice: 200 }] });
    const d = tx.walletTransaction.create.mock.calls[0][0].data;
    expect(d.balanceAfter).toBe(-40);
    expect(d.balanceBefore).toBe(140);
  });
});