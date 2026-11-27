import { describe, it, expect, vi } from "vitest";
import { hasAnyLogisticsAccess } from "./logistics-scope";

const h = vi.hoisted(() => ({ user: null as any, scope: null as any }));
vi.mock("@/lib/prisma", () => {
  const deep: any = new Proxy(function () {}, { get: (_t, k) => (k === "then" ? undefined : deep), apply: async () => [] });
  return { prisma: deep };
});
vi.mock("@/services/session.service", () => ({ SessionService: { getCurrent: vi.fn(async () => (h.user ? { user: h.user } : null)) } }));
vi.mock("@/services/logistics-scope.service", () => ({ LogisticsScopeService: { forUser: vi.fn(async () => h.scope) } }));

const NONE: any = { platform: false, companyIds: [], warehouseIds: [] };
const MEMBER: any = { platform: false, companyIds: [2], warehouseIds: [5] };
const LEGACY: any = { platform: false, companyIds: [], warehouseIds: [1] };
const PLATFORM: any = { platform: true, companyIds: [], warehouseIds: [1] };

const routes: [string, () => Promise<any>, "GET" | "POST"][] = [
  ["shipments", () => import("../app/api/warehouse/shipments/route"), "GET"],
  ["shipments/[id]", () => import("../app/api/warehouse/shipments/[id]/route"), "GET"],
  ["shipments/[id]/assign", () => import("../app/api/warehouse/shipments/[id]/assign/route"), "POST"],
  ["shipments/[id]/cancel", () => import("../app/api/warehouse/shipments/[id]/cancel/route"), "POST"],
  ["shipments/[id]/label", () => import("../app/api/warehouse/shipments/[id]/label/route"), "GET"],
  ["drivers/available", () => import("../app/api/warehouse/drivers/available/route"), "GET"],
  ["drivers/cash/pending", () => import("../app/api/warehouse/drivers/cash/pending/route"), "GET"],
  ["drivers/schedule", () => import("../app/api/warehouse/drivers/schedule/route"), "GET"],
  ["drivers/wallet/pending", () => import("../app/api/warehouse/drivers/wallet/pending/route"), "GET"],
  ["tracking/live", () => import("../app/api/warehouse/tracking/live/route"), "GET"],
];

async function call(load: () => Promise<any>, method: "GET" | "POST", user: any, scope: any) {
  h.user = user;
  h.scope = scope;
  const mod = await load();
  const req = new Request("http://localhost/x", { method, headers: { "content-type": "application/json" }, body: method === "POST" ? "{}" : undefined });
  const res = await mod[method](req, { params: Promise.resolve({ id: "1" }) });
  return res.status as number;
}

describe("افتراضات النطاق", () => {
  it("hasAnyLogisticsAccess يتصرف كما نتوقع", () => {
    expect(hasAnyLogisticsAccess(NONE)).toBe(false);
    expect(hasAnyLogisticsAccess(MEMBER)).toBe(true);
    expect(hasAnyLogisticsAccess(LEGACY)).toBe(true);
    expect(hasAnyLogisticsAccess(PLATFORM)).toBe(true);
  });
});

describe.each(routes)("بوابة النطاق: %s", (_name, load, method) => {
  it("بلا جلسة: مرفوض", async () => {
    expect([401, 403]).toContain(await call(load, method, null, NONE));
  });
  it("عميل بلا نطاق: 403", async () => {
    expect(await call(load, method, { id: 9, role: "CUSTOMER" }, NONE)).toBe(403);
  });
  it("دور غير قديم لكن بعضوية فعلية: يُسمح له", async () => {
    expect(await call(load, method, { id: 9, role: "DELIVERY" }, MEMBER)).not.toBe(403);
  });
  it("دور غير قديم بلا عضوية: 403", async () => {
    expect(await call(load, method, { id: 9, role: "DELIVERY" }, NONE)).toBe(403);
  });
  it("مدير مستودع قديم (المستودع 1) والأدمن: يُسمح لهما", async () => {
    expect(await call(load, method, { id: 9, role: "WAREHOUSE_MANAGER" }, LEGACY)).not.toBe(403);
    expect(await call(load, method, { id: 1, role: "ADMIN" }, PLATFORM)).not.toBe(403);
  });
});
