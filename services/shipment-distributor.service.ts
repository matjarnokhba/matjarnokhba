/* eslint-disable @typescript-eslint/no-explicit-any */
import { STORE_PLATFORM_CODE } from "@/services/shipment-assignment.service";

export type DistributionDecision = {
  companyId: number;
  warehouseId: number;
  mode: "AUTO" | "BY_CITY";
  reason: "PRIMARY" | "FALLBACK" | "CITY_COVERED" | "NO_COVERAGE";
};

export type DistributionInput = {
  platformCode?: string;
  shippingAddressId?: number | null;
  snapshot?: any;
};

async function cityIdOf(tx: any, input: DistributionInput): Promise<number | null> {
  let name: unknown = input.snapshot && typeof input.snapshot === "object" ? (input.snapshot as any).city : null;
  if (input.shippingAddressId) {
    const a = await tx.address.findUnique({ where: { id: input.shippingAddressId }, select: { cityId: true, city: true } });
    if (a?.cityId) return a.cityId as number;
    if (a?.city) name = a.city;
  }
  const n = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!n) return null;
  const c = await tx.city.findFirst({ where: { name: n, isActive: true }, select: { id: true } });
  return c?.id ?? null;
}

/** warehouseId لأول مستودع نشط للشركة إن كانت الشركة نشطة ومرتبطة بالمنصة ربطاً نشطاً، وإلا null */
async function usableWarehouse(tx: any, platformId: number, companyId: number): Promise<number | null> {
  const c = await tx.logisticsCompany.findUnique({ where: { id: companyId }, select: { status: true } });
  if (!c || c.status !== "ACTIVE") return null;
  const l = await tx.companyPlatformLink.findUnique({ where: { companyId_platformId: { companyId, platformId } }, select: { status: true } });
  if (!l || l.status !== "ACTIVE") return null;
  const w = await tx.warehouse.findFirst({ where: { companyId, status: "ACTIVE" }, orderBy: { id: "asc" }, select: { id: true } });
  return w?.id ?? null;
}

export const ShipmentDistributor = {
  /**
   * يحدد الشركة والمستودع لطلب جديد حسب إعداد المنصة.
   * يُرجع null عندما لا قرار (يدوي، لا إعداد، لا شركة صالحة) فيبقى السلوك الحالي.
   */
  async resolve(tx: any, input: DistributionInput): Promise<DistributionDecision | null> {
    const platform = await tx.clientPlatform.findUnique({ where: { code: input.platformCode ?? STORE_PLATFORM_CODE }, select: { id: true } });
    if (!platform) return null;
    const cfg = await tx.platformRoutingConfig.findUnique({ where: { platformId: platform.id } });
    if (!cfg || cfg.mode === "MANUAL" || !cfg.primaryCompanyId) return null;

    const order: number[] = [cfg.primaryCompanyId];
    if (cfg.fallbackCompanyId) order.push(cfg.fallbackCompanyId);

    let covered = new Set<number>();
    let candidates = order;
    if (cfg.mode === "BY_CITY") {
      const cityId = await cityIdOf(tx, input);
      if (cityId) {
        const rows = await tx.companyCityCoverage.findMany({ where: { cityId, companyId: { in: order } }, select: { companyId: true } });
        covered = new Set<number>(rows.map((r: any) => r.companyId as number));
        candidates = [...order.filter((c) => covered.has(c)), ...order.filter((c) => !covered.has(c))];
      }
    }

    for (const companyId of candidates) {
      const warehouseId = await usableWarehouse(tx, platform.id, companyId);
      if (warehouseId === null) continue;
      const reason: DistributionDecision["reason"] =
        cfg.mode === "AUTO" ? (companyId === cfg.primaryCompanyId ? "PRIMARY" : "FALLBACK") : covered.has(companyId) ? "CITY_COVERED" : "NO_COVERAGE";
      return { companyId, warehouseId, mode: cfg.mode, reason };
    }
    return null;
  },
};
