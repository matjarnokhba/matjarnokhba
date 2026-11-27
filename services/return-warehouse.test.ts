import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { ReturnWarehouseService } from "./return-warehouse.service";
import { WalletService } from "./wallet.service";

function shipTx(byItems: number | null, byOrder: number | null) {
  const wrap = (w: number | null) => (w == null ? null : { shipment: { originWarehouseId: w } });
  return {
    shipmentItem: {
      findFirst: vi.fn(async (args: any) => (args.where.orderItemId ? wrap(byItems) : wrap(byOrder))),
    },
  } as any;
}

describe("ReturnWarehouseService.resolve", () => {
  it("مستودع شحنة الأصناف المرتجعة (الأحدث أولاً)", async () => {
    const tx = shipTx(7, 3);
    expect(await ReturnWarehouseService.resolve(tx, { orderId: 1, orderItemIds: [10, 11] })).toBe(7);
    const a = tx.shipmentItem.findFirst.mock.calls[0][0];
    expect(a.where).toEqual({ orderId: 1, orderItemId: { in: [10, 11] } });
    expect(a.orderBy).toEqual({ id: "desc" });
  });
  it("لا شحنة لتلك الأصناف: أحدث شحنة للطلب", async () => {
    const tx = shipTx(null, 3);
    expect(await ReturnWarehouseService.resolve(tx, { orderId: 1, orderItemIds: [10] })).toBe(3);
    expect(tx.shipmentItem.findFirst).toHaveBeenCalledTimes(2);
  });
  it("بلا أصناف محددة: استعلام الطلب فقط", async () => {
    const tx = shipTx(7, 4);
    expect(await ReturnWarehouseService.resolve(tx, { orderId: 1, orderItemIds: [] })).toBe(4);
    expect(tx.shipmentItem.findFirst).toHaveBeenCalledTimes(1);
  });
  it("بلا أي شحنة: خطأ واضح 409 وليس قيمة افتراضية", async () => {
    const tx = shipTx(null, null);
    await expect(ReturnWarehouseService.resolve(tx, { orderId: 1, orderItemIds: [10] })).rejects.toMatchObject({ status: 409 });
  });
});

describe("WalletService.settleReturnShipping: مستودع المرتجع", () => {
  it("تُقيَّد الكلفة على محفظة المستودع المحدد لا مستودع ثابت", async () => {
    const tx = {
      wallet: { upsert: vi.fn().mockResolvedValue({ id: 9 }) },
      walletTransactionUnified: { create: vi.fn().mockResolvedValue({}) },
    } as any;
    await WalletService.settleReturnShipping(tx, { returnId: 5, orderNumber: "O-5", sellerId: 2, payer: "CUSTOMER", fee: 15, warehouseId: 7 });
    const a = tx.wallet.upsert.mock.calls[0][0];
    expect(a.where.ownerType_ownerId).toEqual({ ownerType: "WAREHOUSE", ownerId: 7 });
    expect(a.create).toEqual({ ownerType: "WAREHOUSE", ownerId: 7, balance: 15 });
    expect(a.update.balance).toEqual({ increment: 15 });
  });
});
