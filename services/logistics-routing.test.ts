import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/logistics-audit", () => ({ logLogisticsAudit: vi.fn() }));

import { LogisticsRoutingService } from "./logistics-routing.service";

const PLATFORM: any = { id: 1, scope: { platform: true, companyIds: [], warehouseIds: [] } };
const HEAD2: any = { id: 7, scope: { platform: false, companyIds: [2], warehouseIds: [] } };

function makeTx(over: any = {}) {
  return {
    clientPlatform: { findUnique: vi.fn().mockResolvedValue({ id: 1 }) },
    logisticsCompany: { findUnique: vi.fn(async ({ where }: any) => ({ id: where.id, status: "ACTIVE" })) },
    companyPlatformLink: { findUnique: vi.fn().mockResolvedValue({ status: "ACTIVE" }) },
    platformRoutingConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(async ({ create }: any) => ({ id: 5, ...create })),
    },
    city: { findMany: vi.fn(async ({ where }: any) => where.id.in.map((id: number) => ({ id }))) },
    companyCityCoverage: {
      findMany: vi.fn().mockResolvedValue([{ cityId: 9 }]),
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
    },
    ...over,
  } as any;
}

describe("setConfig", () => {
  it("غير الأدمن: 403", async () => {
    await expect(LogisticsRoutingService.setConfig(HEAD2, { platformId: 1, mode: "MANUAL" }, { tx: makeTx() })).rejects.toMatchObject({ status: 403 });
  });
  it("شركة غير مرتبطة ربطاً نشطاً: 409", async () => {
    const tx = makeTx({ companyPlatformLink: { findUnique: vi.fn().mockResolvedValue({ status: "PAUSED" }) } });
    await expect(LogisticsRoutingService.setConfig(PLATFORM, { platformId: 1, mode: "AUTO", primaryCompanyId: 2 }, { tx })).rejects.toMatchObject({ status: 409 });
    expect(tx.platformRoutingConfig.upsert).not.toHaveBeenCalled();
  });
  it("لا ربط أصلاً: 409", async () => {
    const tx = makeTx({ companyPlatformLink: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(LogisticsRoutingService.setConfig(PLATFORM, { platformId: 1, mode: "AUTO", primaryCompanyId: 2 }, { tx })).rejects.toMatchObject({ status: 409 });
  });
  it("شركة غير نشطة: 409", async () => {
    const tx = makeTx({ logisticsCompany: { findUnique: vi.fn(async ({ where }: any) => ({ id: where.id, status: "SUSPENDED" })) } });
    await expect(LogisticsRoutingService.setConfig(PLATFORM, { platformId: 1, mode: "AUTO", primaryCompanyId: 2 }, { tx })).rejects.toMatchObject({ status: 409 });
  });
  it("منصة غير موجودة: 404", async () => {
    const tx = makeTx({ clientPlatform: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(LogisticsRoutingService.setConfig(PLATFORM, { platformId: 9, mode: "MANUAL" }, { tx })).rejects.toMatchObject({ status: 404 });
  });
  it("إعداد صحيح: يُحفظ بالقيم المرسلة وبمعرّف المحدِّث", async () => {
    const tx = makeTx();
    await LogisticsRoutingService.setConfig(PLATFORM, { platformId: 1, mode: "AUTO", primaryCompanyId: 2, fallbackCompanyId: 3 }, { tx });
    const a = tx.platformRoutingConfig.upsert.mock.calls[0][0];
    expect(a.where).toEqual({ platformId: 1 });
    expect(a.update).toEqual({ mode: "AUTO", primaryCompanyId: 2, fallbackCompanyId: 3, updatedById: 1 });
  });
});

describe("setCoverage", () => {
  it("رئيس الشركة يعدّل شركته: مسموح", async () => {
    const tx = makeTx();
    const r = await LogisticsRoutingService.setCoverage(HEAD2, { companyId: 2, cityIds: [4, 5, 5] }, { tx });
    expect(r.cityIds).toEqual([4, 5]);
    expect(tx.companyCityCoverage.deleteMany.mock.calls[0][0].where).toEqual({ companyId: 2, cityId: { notIn: [4, 5] } });
    expect(tx.companyCityCoverage.createMany.mock.calls[0][0].data).toHaveLength(2);
  });
  it("رئيس الشركة يعدّل شركة غيره: 403", async () => {
    await expect(LogisticsRoutingService.setCoverage(HEAD2, { companyId: 3, cityIds: [1] }, { tx: makeTx() })).rejects.toMatchObject({ status: 403 });
  });
  it("الأدمن يعدّل أي شركة دون إذن أحد", async () => {
    const tx = makeTx();
    await expect(LogisticsRoutingService.setCoverage(PLATFORM, { companyId: 3, cityIds: [1] }, { tx })).resolves.toMatchObject({ companyId: 3 });
  });
  it("مدينة غير موجودة: 409 ولا تغيير", async () => {
    const tx = makeTx({ city: { findMany: vi.fn().mockResolvedValue([]) } });
    await expect(LogisticsRoutingService.setCoverage(PLATFORM, { companyId: 2, cityIds: [999] }, { tx })).rejects.toMatchObject({ status: 409 });
    expect(tx.companyCityCoverage.deleteMany).not.toHaveBeenCalled();
  });
  it("قائمة فارغة: تُفرَّغ التغطية بلا إنشاء", async () => {
    const tx = makeTx();
    await LogisticsRoutingService.setCoverage(PLATFORM, { companyId: 2, cityIds: [] }, { tx });
    expect(tx.companyCityCoverage.deleteMany).toHaveBeenCalled();
    expect(tx.companyCityCoverage.createMany).not.toHaveBeenCalled();
  });
});
