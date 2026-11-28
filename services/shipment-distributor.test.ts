import { describe, it, expect, vi } from "vitest";

vi.mock("@/services/shipment-assignment.service", () => ({ STORE_PLATFORM_CODE: "NOKHBA" }));

import { ShipmentDistributor } from "./shipment-distributor.service";

type S = {
  cfg: any;
  companies?: Record<number, string>;
  links?: Record<number, string>;
  warehouses?: Record<number, number>;
  coverage?: { companyId: number; cityId: number }[];
  cities?: Record<string, number>;
  address?: any;
};

function tx(s: S) {
  return {
    clientPlatform: { findUnique: vi.fn().mockResolvedValue({ id: 1 }) },
    platformRoutingConfig: { findUnique: vi.fn().mockResolvedValue(s.cfg) },
    address: { findUnique: vi.fn().mockResolvedValue(s.address ?? null) },
    city: { findFirst: vi.fn(async ({ where }: any) => (s.cities?.[where.name] ? { id: s.cities[where.name] } : null)) },
    companyCityCoverage: { findMany: vi.fn(async ({ where }: any) => (s.coverage ?? []).filter((r) => r.cityId === where.cityId && where.companyId.in.includes(r.companyId))) },
    logisticsCompany: { findUnique: vi.fn(async ({ where }: any) => ({ status: s.companies?.[where.id] ?? "ACTIVE" })) },
    companyPlatformLink: { findUnique: vi.fn(async ({ where }: any) => { const st = s.links?.[where.companyId_platformId.companyId] ?? "ACTIVE"; return { status: st }; }) },
    warehouse: { findFirst: vi.fn(async ({ where }: any) => { const w = (s.warehouses ?? { 1: 11, 2: 22 })[where.companyId]; return w ? { id: w } : null; }) },
  } as any;
}
const AUTO = { mode: "AUTO", primaryCompanyId: 1, fallbackCompanyId: 2 };
const BYCITY = { mode: "BY_CITY", primaryCompanyId: 1, fallbackCompanyId: 2 };

describe("ShipmentDistributor.resolve", () => {
  it("بلا إعداد أو يدوي: null", async () => {
    expect(await ShipmentDistributor.resolve(tx({ cfg: null }), {})).toBeNull();
    expect(await ShipmentDistributor.resolve(tx({ cfg: { mode: "MANUAL", primaryCompanyId: null, fallbackCompanyId: null } }), {})).toBeNull();
  });
  it("تلقائي: الرئيسية ومستودعها", async () => {
    expect(await ShipmentDistributor.resolve(tx({ cfg: AUTO }), {})).toEqual({ companyId: 1, warehouseId: 11, mode: "AUTO", reason: "PRIMARY" });
  });
  it("تلقائي: ربط الرئيسية متوقف -> الاحتياطية", async () => {
    const r = await ShipmentDistributor.resolve(tx({ cfg: AUTO, links: { 1: "PAUSED" } }), {});
    expect(r).toMatchObject({ companyId: 2, warehouseId: 22, reason: "FALLBACK" });
  });
  it("تلقائي: الرئيسية موقوفة وبلا مستودع نشط للاحتياطية -> null", async () => {
    expect(await ShipmentDistributor.resolve(tx({ cfg: AUTO, companies: { 1: "SUSPENDED" }, warehouses: { 1: 11 } }), {})).toBeNull();
  });
  it("حسب المدينة: الاحتياطية تغطي المدينة فتتقدم", async () => {
    const r = await ShipmentDistributor.resolve(tx({ cfg: BYCITY, coverage: [{ companyId: 2, cityId: 5 }], address: { cityId: 5, city: "x" } }), { shippingAddressId: 9 });
    expect(r).toMatchObject({ companyId: 2, reason: "CITY_COVERED" });
  });
  it("حسب المدينة: الرئيسية أولاً إن غطّت الاثنتان", async () => {
    const r = await ShipmentDistributor.resolve(tx({ cfg: BYCITY, coverage: [{ companyId: 1, cityId: 5 }, { companyId: 2, cityId: 5 }], address: { cityId: 5 } }), { shippingAddressId: 9 });
    expect(r).toMatchObject({ companyId: 1, reason: "CITY_COVERED" });
  });
  it("حسب المدينة: لا تغطية -> الرئيسية بسبب NO_COVERAGE", async () => {
    const r = await ShipmentDistributor.resolve(tx({ cfg: BYCITY, coverage: [] }), { snapshot: { city: "مدينة مجهولة" } });
    expect(r).toMatchObject({ companyId: 1, reason: "NO_COVERAGE" });
  });
  it("حسب المدينة: المدينة من اسم الـ snapshot عند غياب cityId", async () => {
    const r = await ShipmentDistributor.resolve(tx({ cfg: BYCITY, cities: { "الدار البيضاء": 1 }, coverage: [{ companyId: 2, cityId: 1 }] }), { snapshot: { city: "  الدار   البيضاء " } });
    expect(r).toMatchObject({ companyId: 2, reason: "CITY_COVERED" });
  });
  it("عنوان بلا cityId يستعمل نصه القديم", async () => {
    const r = await ShipmentDistributor.resolve(tx({ cfg: BYCITY, cities: { "سطات": 3 }, coverage: [{ companyId: 2, cityId: 3 }], address: { cityId: null, city: "سطات" } }), { shippingAddressId: 4, snapshot: { city: "الدار البيضاء" } });
    expect(r).toMatchObject({ companyId: 2, reason: "CITY_COVERED" });
  });
});
