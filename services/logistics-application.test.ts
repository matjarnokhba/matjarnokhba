import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/logistics-audit", () => ({ logLogisticsAudit: vi.fn() }));

import { LogisticsApplicationService } from "./logistics-application.service";

const ADMIN: any = { id: 1, scope: { platform: true, companyIds: [], warehouseIds: [] } };
const HEAD: any = { id: 7, scope: { platform: false, companyIds: [2], warehouseIds: [] } };

function tx(company: any, membership: any = null) {
  return {
    logisticsCompany: { findUnique: vi.fn().mockResolvedValue(company), update: vi.fn(async ({ data }: any) => ({ ...company, ...data })) },
    logisticsMembership: { findFirst: vi.fn().mockResolvedValue(membership), create: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}) },
  } as any;
}
const pending = { id: 5, status: "PENDING", headUserId: 9, settings: { application: { city: "x" } } };

describe("approve", () => {
  it("غير الأدمن: 403", async () => {
    await expect(LogisticsApplicationService.approve(HEAD, 5, { tx: tx(pending) })).rejects.toMatchObject({ status: 403 });
  });
  it("ليست قيد المراجعة: 409", async () => {
    await expect(LogisticsApplicationService.approve(ADMIN, 5, { tx: tx({ ...pending, status: "ACTIVE" }) })).rejects.toMatchObject({ status: 409 });
  });
  it("قبول: تفعيل وإنشاء عضوية مدير الشركة", async () => {
    const t = tx(pending);
    await LogisticsApplicationService.approve(ADMIN, 5, { tx: t });
    expect(t.logisticsCompany.update.mock.calls[0][0].data).toEqual({ status: "ACTIVE" });
    const m = t.logisticsMembership.create.mock.calls[0][0].data;
    expect(m).toMatchObject({ userId: 9, scope: "COMPANY", companyId: 5, jobRoles: ["MANAGER"], appointedById: 1 });
  });
});
describe("reject", () => {
  it("غير الأدمن: 403", async () => {
    await expect(LogisticsApplicationService.reject(HEAD, 5, "x", { tx: tx(pending) })).rejects.toMatchObject({ status: 403 });
  });
  it("رفض: حالة REJECTED مع السبب وبلا عضوية", async () => {
    const t = tx(pending);
    await LogisticsApplicationService.reject(ADMIN, 5, "ناقصة", { tx: t });
    const d = t.logisticsCompany.update.mock.calls[0][0].data;
    expect(d.status).toBe("REJECTED");
    expect(d.settings.application.rejectedReason).toBe("ناقصة");
    expect(t.logisticsMembership.create).not.toHaveBeenCalled();
  });
});
