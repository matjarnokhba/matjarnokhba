import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { WalletService } from "./wallet.service";

function makeTx(opts: { lines?: any[]; dup?: boolean } = {}) {
  const tx: any = {
    seller: {
      findUnique: vi.fn().mockResolvedValue({ commissionRateOverride: null, heldBalance: 0 }),
      update: vi.fn().mockResolvedValue({}),
    },
    systemPolicy: { findUnique: vi.fn().mockResolvedValue({ value: 0.1 }) },
    flashSaleOrderLine: {
      findMany: vi.fn().mockResolvedValue(opts.lines ?? []),
      updateMany: vi.fn().mockResolvedValue({}),
    },
    walletTransaction: {
      findUnique: vi.fn().mockResolvedValue(opts.dup ? { id: 1 } : null),
      create: vi.fn().mockResolvedValue({}),
    },
    order: { update: vi.fn().mockResolvedValue({}) },
    wallet: { upsert: vi.fn().mockResolvedValue({ id: 99 }) },
    walletTransactionUnified: { create: vi.fn().mockResolvedValue({}) },
  };
  return tx;
}

describe("WalletService.addHeldEarning", () => {
  it("طلب عادي: عمولة 10% والصافي يُكتبان في الطلب وفي الحركة", async () => {
    const tx = makeTx();
    const r = await WalletService.addHeldEarning(tx, 5, 7, 220, 200);
    expect(r.commissionAmount).toBe(20);
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { commission: 20, sellerPayout: 180 },
    });
    const data = tx.walletTransaction.create.mock.calls[0][0].data;
    expect(data.orderId).toBe(7);
    expect(data.idempotencyKey).toBe("held:order:7");
    expect(data.amount).toBe(180);
  });

  it("عرض بدعم منصة: يُحاسَب التاجر على سعر القائمة وتخصم المنصة الدعم", async () => {
    const tx = makeTx({ lines: [{ id: 1, platformSubsidy: 40 }] });
    const r = await WalletService.addHeldEarning(tx, 5, 8, 160, 160);
    expect(r.commissionAmount).toBe(20);
    expect(tx.order.update.mock.calls[0][0].data).toEqual({ commission: 20, sellerPayout: 180 });
    expect(tx.wallet.upsert.mock.calls[0][0].create.balance).toBe(-20);
    expect(tx.walletTransactionUnified.create).toHaveBeenCalledTimes(2);
    expect(tx.flashSaleOrderLine.updateMany).toHaveBeenCalled();
  });

  it("التكرار: لا يحتسب الطلب مرتين", async () => {
    const tx = makeTx({ dup: true });
    const r = await WalletService.addHeldEarning(tx, 5, 7, 220, 200);
    expect(r.commissionAmount).toBe(0);
    expect(tx.seller.update).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });
});