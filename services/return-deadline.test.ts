import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const approve = vi.fn();
vi.mock("@/services/return.service", () => ({ ReturnService: { approve: (...a: any[]) => approve(...a) } }));

import { ReturnDeadlineService } from "./return-deadline.service";

const order = { orderNumber: "O-1", seller: { userId: 9 } };

function makeDb(opts: { rows: any[]; auto?: boolean; already?: boolean }) {
  return {
    systemPolicy: { findUnique: vi.fn().mockResolvedValue(opts.auto === false ? { value: false } : null) },
    returnRequest: {
      findMany: vi.fn().mockResolvedValue(opts.rows),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    notification: {
      create: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(opts.already ? { id: 1 } : null),
    },
    user: { findMany: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]) },
  } as any;
}

describe("ReturnDeadlineService.processOverdue", () => {
  beforeEach(() => {
    approve.mockReset();
    approve.mockResolvedValue({ success: true });
  });

  it("عيب مع دليل: يُعتمد تلقائياً ويُنبَّه التاجر", async () => {
    const db = makeDb({ rows: [{ id: 5, reasonType: "DEFECTIVE", evidenceUrls: ["https://x/y.jpg"], order }] });
    const r = await ReturnDeadlineService.processOverdue(db);
    expect(r.approved).toBe(1);
    expect(approve).toHaveBeenCalledWith(5, 0);
    expect(db.returnRequest.updateMany.mock.calls[0][0].data.adminNote).toContain("تلقائياً");
    expect(db.notification.create.mock.calls[0][0].data.userId).toBe(9);
  });

  it("تغيير رأي: لا اعتماد تلقائي، ينبَّه الأدمن مرة", async () => {
    const db = makeDb({ rows: [{ id: 6, reasonType: "CHANGED_MIND", evidenceUrls: [], order }] });
    const r = await ReturnDeadlineService.processOverdue(db);
    expect(r.approved).toBe(0);
    expect(r.escalated).toBe(1);
    expect(approve).not.toHaveBeenCalled();
    expect(db.notification.create).toHaveBeenCalledTimes(2);
  });

  it("عيب بلا دليل: لا يُعتمد تلقائياً", async () => {
    const db = makeDb({ rows: [{ id: 7, reasonType: "WRONG_ITEM", evidenceUrls: [], order }] });
    const r = await ReturnDeadlineService.processOverdue(db);
    expect(r.approved).toBe(0);
    expect(r.escalated).toBe(1);
  });

  it("الاعتماد التلقائي معطّل: تنبيه فقط", async () => {
    const db = makeDb({ auto: false, rows: [{ id: 8, reasonType: "DEFECTIVE", evidenceUrls: ["https://x/y.jpg"], order }] });
    const r = await ReturnDeadlineService.processOverdue(db);
    expect(r.approved).toBe(0);
    expect(r.escalated).toBe(1);
    expect(approve).not.toHaveBeenCalled();
  });

  it("تنبيه سبق إرساله: لا يتكرر", async () => {
    const db = makeDb({ already: true, rows: [{ id: 9, reasonType: "CHANGED_MIND", evidenceUrls: [], order }] });
    const r = await ReturnDeadlineService.processOverdue(db);
    expect(r.escalated).toBe(0);
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it("فشل الاعتماد: يُحتسب فشلاً ولا يوقف الباقي", async () => {
    approve.mockRejectedValueOnce(new Error("status changed"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const db = makeDb({
      rows: [
        { id: 10, reasonType: "DEFECTIVE", evidenceUrls: ["https://a/b.jpg"], order },
        { id: 11, reasonType: "DEFECTIVE", evidenceUrls: ["https://a/c.jpg"], order },
      ],
    });
    const r = await ReturnDeadlineService.processOverdue(db);
    expect(r.failed).toBe(1);
    expect(r.approved).toBe(1);
  });
});