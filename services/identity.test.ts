import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { normalizePhone, normalizeEmail } from "../lib/identity";
import { IdentityService } from "./identity.service";

describe("normalizePhone", () => {
  it("يوحّد الصيغ المغربية", () => {
    for (const v of ["0661234567", "+212661234567", "00212661234567", "212661234567", "661234567", "06 61 23 45 67", "+212 0661234567", "٠٦٦١٢٣٤٥٦٧"]) {
      expect(normalizePhone(v)).toBe("+212661234567");
    }
  });
  it("يرفض غير الصالح", () => {
    for (const v of ["", "12345", "0961234567", "abc", "+33612345678", null, undefined]) {
      expect(normalizePhone(v as any)).toBeNull();
    }
  });
});

describe("normalizeEmail", () => {
  it("حروف صغيرة وGmail بلا نقاط ولا +tag", () => {
    expect(normalizeEmail("  John.Doe+shop@Gmail.com ")).toBe("johndoe@gmail.com");
    expect(normalizeEmail("a.b@googlemail.com")).toBe("ab@gmail.com");
    expect(normalizeEmail("Ali.K+x@example.com")).toBe("ali.k@example.com");
    expect(normalizeEmail("bad")).toBeNull();
  });
});

function makeTx(opts: { user?: any; byPhone?: any; byEmail?: any } = {}) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(opts.user ?? { id: 1, email: "A.b@gmail.com", phone: "0661234567", identityId: null }),
      update: vi.fn().mockResolvedValue({}),
    },
    customerIdentity: {
      findUnique: vi.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where.phoneE164 ? opts.byPhone ?? null : opts.byEmail ?? null)
      ),
      create: vi.fn().mockResolvedValue({ id: 10 }),
      update: vi.fn().mockImplementation(({ where }: any) => Promise.resolve({ id: where.id })),
      updateMany: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

describe("IdentityService.attachUser", () => {
  it("لا هوية سابقة: تُنشأ هوية بالهاتف والإيميل الموحّدين", async () => {
    const tx = makeTx();
    const id = await IdentityService.attachUser(tx, 1);
    expect(id).toBe(10);
    expect(tx.customerIdentity.create.mock.calls[0][0].data).toEqual({ phoneE164: "+212661234567", emailNorm: "ab@gmail.com" });
    expect(tx.user.update.mock.calls[0][0].data).toEqual({ identityId: 10 });
  });
  it("نفس الهاتف: يرتبط بالهوية القديمة ويكمل الإيميل", async () => {
    const tx = makeTx({ byPhone: { id: 7, phoneE164: "+212661234567", emailNorm: null } });
    const id = await IdentityService.attachUser(tx, 1);
    expect(id).toBe(7);
    expect(tx.customerIdentity.create).not.toHaveBeenCalled();
    expect(tx.customerIdentity.update.mock.calls[0][0].data).toEqual({ emailNorm: "ab@gmail.com" });
  });
  it("هاتف وإيميل لهويتين مختلفتين: تُعلَّمان للمراجعة والهاتف يغلب", async () => {
    const tx = makeTx({
      byPhone: { id: 7, phoneE164: "+212661234567", emailNorm: null },
      byEmail: { id: 8, phoneE164: null, emailNorm: "ab@gmail.com" },
    });
    const id = await IdentityService.attachUser(tx, 1);
    expect(id).toBe(7);
    expect(tx.customerIdentity.updateMany.mock.calls[0][0].where.id).toEqual({ in: [7, 8] });
  });
  it("حساب مرتبط مسبقاً: لا يتغير", async () => {
    const tx = makeTx({ user: { id: 1, email: "x@y.com", phone: null, identityId: 3 } });
    expect(await IdentityService.attachUser(tx, 1)).toBe(3);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});