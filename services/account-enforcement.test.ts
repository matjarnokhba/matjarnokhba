import { describe, it, expect, vi } from "vitest";
import { AccountEnforcementService } from "./account-enforcement.service";

function makeTx(opts: { count?: number; limit?: number | null; status?: string } = {}) {
  return {
    systemPolicy: { findUnique: vi.fn().mockResolvedValue(opts.limit === undefined || opts.limit === null ? null : { value: opts.limit }) },
    returnRequest: { count: vi.fn().mockResolvedValue(opts.count ?? 0) },
    seller: {
      findUnique: vi.fn().mockResolvedValue({ status: opts.status ?? "ACTIVE", userId: 9, storeName: "S" }),
      update: vi.fn().mockResolvedValue({}),
    },
    notification: { create: vi.fn().mockResolvedValue({}) },
    user: {
      findMany: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
      update: vi.fn().mockResolvedValue({ identityId: 4 }),
    },
    session: { updateMany: vi.fn().mockResolvedValue({}) },
    customerIdentity: { updateMany: vi.fn().mockResolvedValue({}) },
  } as any;
}

describe("AccountEnforcementService.checkSellerStrikes", () => {
  it("أقل من الحد: لا إيقاف", async () => {
    const tx = makeTx({ count: 2 });
    const r: any = await AccountEnforcementService.checkSellerStrikes(tx, 5, "DEFECTIVE");
    expect(r.suspended).toBe(false);
    expect(tx.seller.update).not.toHaveBeenCalled();
  });
  it("3 أخطاء من نفس النوع: يُوقف التاجر ويُنبَّه هو والأدمن", async () => {
    const tx = makeTx({ count: 3 });
    const r: any = await AccountEnforcementService.checkSellerStrikes(tx, 5, "DEFECTIVE");
    expect(r.suspended).toBe(true);
    expect(tx.seller.update.mock.calls[0][0].data).toEqual({ status: "SUSPENDED" });
    expect(tx.notification.create).toHaveBeenCalledTimes(3);
    expect(tx.returnRequest.count.mock.calls[0][0].where.reasonType).toBe("DEFECTIVE");
  });
  it("الحد من الإعدادات (5): 3 لا تكفي", async () => {
    const tx = makeTx({ count: 3, limit: 5 });
    expect(((await AccountEnforcementService.checkSellerStrikes(tx, 5, "WRONG_ITEM")) as any).suspended).toBe(false);
  });
  it("الحد 0: معطّل", async () => {
    const tx = makeTx({ count: 50, limit: 0 });
    expect(((await AccountEnforcementService.checkSellerStrikes(tx, 5, "LOST")) as any).suspended).toBe(false);
    expect(tx.returnRequest.count).not.toHaveBeenCalled();
  });
  it("تاجر موقوف مسبقاً: لا تكرار", async () => {
    const tx = makeTx({ count: 9, status: "SUSPENDED" });
    expect(((await AccountEnforcementService.checkSellerStrikes(tx, 5, "DEFECTIVE")) as any).suspended).toBe(false);
    expect(tx.seller.update).not.toHaveBeenCalled();
  });
});

describe("AccountEnforcementService.suspendCustomer", () => {
  it("يوقف الحساب وينهي الجلسات ويعلّم الهوية", async () => {
    const tx = makeTx();
    await AccountEnforcementService.suspendCustomer(tx, { userId: 7, reason: "ادعى كسراً وهو من كسره" });
    expect(tx.user.update.mock.calls[0][0].data.suspendedAt).toBeInstanceOf(Date);
    expect(tx.session.updateMany.mock.calls[0][0].where).toEqual({ userId: 7, revokedAt: null });
    expect(tx.customerIdentity.updateMany.mock.calls[0][0].where.id).toBe(4);
  });
});