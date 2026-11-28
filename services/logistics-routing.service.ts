/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { LogisticsError } from "@/lib/logistics-errors";
import { logLogisticsAudit } from "@/lib/logistics-audit";
import type { Actor } from "@/services/logistics-admin.service";
import type { RoutingConfigInput, CoverageSetInput } from "@/lib/logistics-routing-validation";

type Opts = { tx?: any };

async function run<T>(opts: Opts | undefined, fn: (tx: any) => Promise<T>): Promise<T> {
  if (opts?.tx) return fn(opts.tx);
  return (prisma as any).$transaction(fn, { timeout: 20000 }) as Promise<T>;
}

function needPlatform(actor: Actor) {
  if (!actor.scope.platform) throw new LogisticsError("هذه العملية للأدمن فقط", 403);
}

export const LogisticsRoutingService = {
  /** المنصات مع إعداد توزيعها والشركات المرتبطة بها ربطاً نشطاً (للأدمن فقط). */
  async listConfigs(actor: Actor, opts?: Opts) {
    needPlatform(actor);
    const db = opts?.tx ?? (prisma as any);
    const platforms = await db.clientPlatform.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        status: true,
        routingConfig: { select: { mode: true, primaryCompanyId: true, fallbackCompanyId: true, updatedAt: true } },
        links: { where: { status: "ACTIVE" }, select: { company: { select: { id: true, code: true, name: true, status: true } } } },
      },
    });
    return platforms.map((p: any) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      kind: p.kind,
      status: p.status,
      config: p.routingConfig ?? null,
      companies: p.links.filter((l: any) => l.company.status === "ACTIVE").map((l: any) => ({ id: l.company.id, code: l.company.code, name: l.company.name })),
    }));
  },

  async setConfig(actor: Actor, input: RoutingConfigInput, opts?: Opts) {
    needPlatform(actor);
    return run(opts, async (tx) => {
      const platform = await tx.clientPlatform.findUnique({ where: { id: input.platformId }, select: { id: true } });
      if (!platform) throw new LogisticsError("المنصة غير موجودة", 404);
      const primary = input.primaryCompanyId ?? null;
      const fallback = input.fallbackCompanyId ?? null;
      for (const cid of [primary, fallback]) {
        if (cid === null) continue;
        const c = await tx.logisticsCompany.findUnique({ where: { id: cid }, select: { id: true, status: true } });
        if (!c) throw new LogisticsError("الشركة غير موجودة", 404);
        if (c.status !== "ACTIVE") throw new LogisticsError("الشركة غير نشطة", 409);
        const l = await tx.companyPlatformLink.findUnique({
          where: { companyId_platformId: { companyId: cid, platformId: platform.id } },
          select: { status: true },
        });
        if (!l || l.status !== "ACTIVE") throw new LogisticsError("الشركة غير مرتبطة بهذه المنصة ربطاً نشطاً", 409);
      }
      const before = await tx.platformRoutingConfig.findUnique({ where: { platformId: platform.id } });
      const data = { mode: input.mode, primaryCompanyId: primary, fallbackCompanyId: fallback, updatedById: actor.id };
      const saved = await tx.platformRoutingConfig.upsert({
        where: { platformId: platform.id },
        create: { platformId: platform.id, ...data },
        update: data,
      });
      await logLogisticsAudit(tx, {
        userId: actor.id,
        action: "LOGISTICS_ROUTING_SET",
        entityType: "PlatformRoutingConfig",
        entityId: saved.id,
        before: before ?? undefined,
        after: saved,
      });
      return saved;
    });
  },

  /** الشركات التي يراها الفاعل مع المدن وتغطية كل شركة. الأدمن: الكل. رئيس الشركة: شركاته فقط. */
  async listCoverage(actor: Actor, opts?: Opts) {
    const db = opts?.tx ?? (prisma as any);
    const companyWhere: any = actor.scope.platform ? { status: "ACTIVE" } : { status: "ACTIVE", id: { in: actor.scope.companyIds } };
    const companies = await db.logisticsCompany.findMany({ where: companyWhere, orderBy: { id: "asc" }, select: { id: true, code: true, name: true } });
    const cities = await db.city.findMany({ where: { isActive: true }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true } });
    const coverage = await db.companyCityCoverage.findMany({
      where: { companyId: { in: companies.map((c: any) => c.id) } },
      select: { companyId: true, cityId: true },
    });
    return { companies, cities, coverage };
  },

  async setCoverage(actor: Actor, input: CoverageSetInput, opts?: Opts) {
    if (!actor.scope.platform && !actor.scope.companyIds.includes(input.companyId)) throw new LogisticsError("غير مصرح", 403);
    return run(opts, async (tx) => {
      const company = await tx.logisticsCompany.findUnique({ where: { id: input.companyId }, select: { id: true } });
      if (!company) throw new LogisticsError("الشركة غير موجودة", 404);
      const ids: number[] = Array.from(new Set<number>(input.cityIds));
      if (ids.length > 0) {
        const cities = await tx.city.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } });
        if (cities.length !== ids.length) throw new LogisticsError("بعض المدن غير موجودة أو غير مفعّلة", 409);
      }
      const current = await tx.companyCityCoverage.findMany({ where: { companyId: company.id }, select: { cityId: true } });
      const before = current.map((r: any) => r.cityId as number).sort((a: number, b: number) => a - b);
      await tx.companyCityCoverage.deleteMany({ where: { companyId: company.id, cityId: { notIn: ids } } });
      if (ids.length > 0) {
        await tx.companyCityCoverage.createMany({
          data: ids.map((cityId) => ({ companyId: company.id, cityId, createdById: actor.id })),
          skipDuplicates: true,
        });
      }
      const after = [...ids].sort((a, b) => a - b);
      await logLogisticsAudit(tx, {
        userId: actor.id,
        action: "LOGISTICS_COVERAGE_SET",
        entityType: "CompanyCityCoverage",
        entityId: company.id,
        before: { cityIds: before },
        after: { cityIds: after },
      });
      return { companyId: company.id, cityIds: after };
    });
  },
};
