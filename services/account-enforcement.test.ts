import { describe, it, expect, vi } from "vitest";
import { AccountEnforcementService } from "./account-enforcement.service";

function makeTx(opts: { count?: number; limit?: number | null; already?: boolean } = {}) {
  return {
    systemPolicy: { findUnique: vi.fn().mockResolvedValue(opts.limit === undefined || opts.limit === null ? null : { value: opts.limit }) },
    returnRequest: { count: vi.fn().mockResolvedValue(opts.count ?? 0) },
    seller: {
      findUnique: vi.fn().mockResolvedValue({ storeName: "S" }),
      update: vi.fn().mockResolvedValue({}),
    },
    notification: {
      create: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(opts.already ? { id: 1 } : null),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
      update: vi.fn().mockResolvedValue({ identityId: 4 }),
    },
    session: { updateMany: vi.fn().mockResolvedValue({}) },
    customerIdentity: { updateMany: vi.fn().mockResolvedValue({}) },
  } as any;
}

describe("AccountEnforcementService.checkSellerStrikes", () => {
  it("أقل من الحد: لا تنبيه", async () => {
    const tx = makeTx({ count: 2 });
    const r: any = await AccountEnforcementService.checkSellerStrikes(tx, 5, "DEFECTIVE");
    expect(r.alerted).toBe(false);
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
  it("3 أخطاء: تنبيه للأدمن فقط ولا يُوقف التاجر", async () => {
    const tx = makeTx({ count: 3 });
    const r: any = await AccountEnforcementService.checkSellerStrikes(tx, 5, "DEFECTIVE");
    expect(r.alerted).toBe(true);
    expect(tx.seller.update).not.toHaveBeenCalled();
    expect(tx.notification.create).toHaveBeenCalledTimes(2);
    expect(tx.notification.create.mock.calls[0][0].data.userId).toBe(1);
  });
  it("تنبيه سبق لنفس العدد: لا تكرار", async () => {
    const tx = makeTx({ count: 3, already: true });
    expect(((await AccountEnforcementService.checkSellerStrikes(tx, 5, "DEFECTIVE")) as any).alerted).toBe(false);
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
  it("الحد من الإعدادات (5): 3 لا تكفي", async () => {
    const tx = makeTx({ count: 3, limit: 5 });
    expect(((await AccountEnforcementService.checkSellerStrikes(tx, 5, "WRONG_ITEM")) as any).alerted).toBe(false);
  });
  it("الحد 0: معطّل", async () => {
    const tx = makeTx({ count: 50, limit: 0 });
    expect(((await AccountEnforcementService.checkSellerStrikes(tx, 5, "LOST")) as any).alerted).toBe(false);
    expect(tx.returnRequest.count).not.toHaveBeenCalled();
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