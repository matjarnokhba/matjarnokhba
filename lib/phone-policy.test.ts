import { describe, it, expect } from "vitest";
import { decidePhoneUpdate } from "./phone-policy";

describe("decidePhoneUpdate", () => {
  it("له هاتف + نفس الرقم بصيغة أخرى: يبقى", () => {
    expect(decidePhoneUpdate({ current: "+212612345678", submitted: "0612345678" }).action).toBe("keep");
  });
  it("له هاتف + تغيير الرقم: مرفوض", () => {
    expect(decidePhoneUpdate({ current: "+212612345678", submitted: "0712345678" }).action).toBe("reject");
  });
  it("له هاتف + حذفه (فارغ): يبقى كما هو", () => {
    expect(decidePhoneUpdate({ current: "+212612345678", submitted: "" }).action).toBe("keep");
  });
  it("بلا هاتف + رقم صالح: يُحفظ مطبَّعاً", () => {
    const r = decidePhoneUpdate({ current: null, submitted: "0612345678" });
    expect(r).toEqual({ action: "set", phone: "+212612345678" });
  });
  it("بلا هاتف + رقم غير صالح: مرفوض", () => {
    expect(decidePhoneUpdate({ current: null, submitted: "123" }).action).toBe("reject");
  });
  it("بلا هاتف + فارغ: لا شيء", () => {
    expect(decidePhoneUpdate({ current: null, submitted: "" }).action).toBe("keep");
  });
});