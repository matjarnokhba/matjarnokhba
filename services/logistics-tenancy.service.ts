/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { LogisticsError } from "@/lib/logistics-errors";
import { logLogisticsAudit } from "@/lib/logistics-audit";
import { canLinkTransition, ACTIVE_DRIVER_SHIPMENT_STATUSES } from "@/lib/logistics-tenancy-rules";
import type { LinkCreateInput, LinkAction, BrandInput } from "@/lib/logistics-tenancy-validation";
import type { Actor } from "@/services/logistics-admin.service";

type Opts = { tx?: any };

async function run<T>(opts: Opts | undefined, fn: (tx: any) => Promise<T>): Promise<T> {
  if (opts?.tx) return fn(opts.tx);
  return (prisma as any).$transaction(fn, { timeout: 20000 }) as Promise<T>;
}

function needPlatform(actor: Actor) {
  if (!actor.scope.platform) throw new LogisticsError("هذه العملية للأدمن فقط", 403);
}

const linkInclude = {
  company: { select: { id: true, code: true, name: true, status: true, allowExternalPlatforms: true } },
  platform: { select: { id: true, code: true, name: true, kind: true, status: true } },
} as const;

const BRAND_SELECT = { id: true, displayName: true, logoUrl: true, brandColor: true, contactPhone: true, contactEmail: true } as const;

export const LogisticsTenancyService = {
  async listLinks(actor: Actor, f: { companyId?: number; platformId?: number }) {
    const where: Record<string, unknown> = {};
    if (f.companyId) where.companyId = f.companyId;
    if (f.platformId) where.platformId = f.platformId;
    if (!actor.scope.platform) {
      const allowed = actor.scope.companyIds.filter((c) => !f.companyId || c === f.companyId);
      where.companyId = { in: allowed };
    }
    return prisma.companyPlatformLink.findMany({ where: where as never, orderBy: { id: "asc" }, take: 300, include: linkInclude });
  },

  async createLink(actor: Actor, input: LinkCreateInput, opts?: Opts) {
    needPlatform(actor);
    return run(opts, async (tx) => {
      const company = await tx.logisticsCompany.findUnique({ where: { id: input.companyId }, select: { id: true, status: true, allowExternalPlatforms: true } });
      const platform = await tx.clientPlatform.findUnique({ where: { id: input.platformId }, select: { id: true, status: true, kind: true } });
      if (!company || !platform) throw new LogisticsError("الشركة أو المنصة غير موجودة", 404);
      if (company.status !== "ACTIVE") throw new LogisticsError("الشركة غير نشطة", 409);
      if (platform.status !== "ACTIVE") throw new LogisticsError("المنصة غير نشطة", 409);
      if (platform.kind === "EXTERNAL" && !company.allowExternalPlatforms) throw new LogisticsError("الشركة غير مسموح لها بالعمل مع منصات خارجية", 409);
      const ex = await tx.companyPlatformLink.findUnique({ where: { companyId_platformId: { companyId: company.id, platformId: platform.id } }, select: { id: true } });
      if (ex) throw new LogisticsError("الربط موجود مسبقاً (استعمل الإيقاف/إعادة التفعيل)", 409);
      const link = await tx.companyPlatformLink.create({ data: { companyId: company.id, platformId: platform.id, notes: input.notes ?? null, linkedById: actor.id } });
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_LINK_CREATE", entityType: "CompanyPlatformLink", entityId: link.id, after: link });
      return tx.companyPlatformLink.findUnique({ where: { id: link.id }, include: linkInclude });
    });
  },

  async actLink(actor: Actor, id: number, a: LinkAction, opts?: Opts) {
    needPlatform(actor);
    return run(opts, async (tx) => {
      const link = await tx.companyPlatformLink.findUnique({ where: { id }, include: linkInclude });
      if (!link) throw new LogisticsError("الربط غير موجود", 404);
      const next = a.action === "pause" ? "PAUSED" : a.action === "revoke" ? "REVOKED" : "ACTIVE";
      if (a.action === "resume" && link.status !== "PAUSED") throw new LogisticsError("الاستئناف من حالة (موقوف) فقط", 409);
      if (a.action === "reinstate" && link.status !== "REVOKED") throw new LogisticsError("إعادة التفعيل من حالة (ملغى) فقط", 409);
      if (!canLinkTransition(link.status, next)) throw new LogisticsError("انتقال غير مسموح من " + link.status + " إلى " + next, 409);
      if (next === "ACTIVE") {
        if (link.company.status !== "ACTIVE") throw new LogisticsError("الشركة غير نشطة", 409);
        if (link.platform.status !== "ACTIVE") throw new LogisticsError("المنصة غير نشطة", 409);
        if (link.platform.kind === "EXTERNAL" && !link.company.allowExternalPlatforms) throw new LogisticsError("الشركة غير مسموح لها بالعمل مع منصات خارجية", 409);
      }
      const now = new Date();
      let data: Record<string, unknown>;
      if (a.action === "pause") data = { status: "PAUSED", pausedAt: now, pausedById: actor.id, pauseReason: a.reason };
      else if (a.action === "revoke") data = { status: "REVOKED", revokedAt: now, revokedById: actor.id, revokeReason: a.reason };
      else data = { status: "ACTIVE", pausedAt: null, pausedById: null, pauseReason: null, revokedAt: null, revokedById: null, revokeReason: null };
      const r = await tx.companyPlatformLink.updateMany({ where: { id, status: link.status }, data });
      if (r.count === 0) throw new LogisticsError("تغيّرت حالة الربط من عملية أخرى، أعد المحاولة", 409);
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_LINK_" + a.action.toUpperCase(), entityType: "CompanyPlatformLink", entityId: id, before: { status: link.status }, after: { status: next, reason: (a as any).reason ?? null } });
      return tx.companyPlatformLink.findUnique({ where: { id }, include: linkInclude });
    });
  },

  /** البوابة المركزية: هل تستطيع هذه المنصة استعمال هذه الشركة الآن؟ */
  async resolveAccess(platformId: number, companyId: number, opts?: Opts): Promise<{ allowed: boolean; reason: string }> {
    const db = opts?.tx ?? prisma;
    const p = await db.clientPlatform.findUnique({ where: { id: platformId }, select: { status: true, kind: true } });
    const c = await db.logisticsCompany.findUnique({ where: { id: companyId }, select: { status: true, allowExternalPlatforms: true } });
    if (!p || !c) return { allowed: false, reason: "NOT_FOUND" };
    if (p.status !== "ACTIVE") return { allowed: false, reason: "PLATFORM_" + p.status };
    if (c.status !== "ACTIVE") return { allowed: false, reason: "COMPANY_" + c.status };
    const l = await db.companyPlatformLink.findUnique({ where: { companyId_platformId: { companyId, platformId } }, select: { status: true } });
    if (!l) return { allowed: false, reason: "NO_LINK" };
    if (l.status !== "ACTIVE") return { allowed: false, reason: "LINK_" + l.status };
    if (p.kind === "EXTERNAL" && !c.allowExternalPlatforms) return { allowed: false, reason: "EXTERNAL_NOT_ALLOWED" };
    return { allowed: true, reason: "OK" };
  },

  async updateBrand(actor: Actor, companyId: number, input: BrandInput, opts?: Opts) {
    return run(opts, async (tx) => {
      const c = await tx.logisticsCompany.findUnique({ where: { id: companyId }, select: { ...BRAND_SELECT, headUserId: true } });
      if (!c) throw new LogisticsError("الشركة غير موجودة", 404);
      if (!actor.scope.platform && c.headUserId !== actor.id) throw new LogisticsError("غير مصرح", 403);
      const data: Record<string, unknown> = {};
      for (const k of ["displayName", "logoUrl", "brandColor", "contactPhone", "contactEmail"] as const) {
        if (input[k] !== undefined) data[k] = input[k];
      }
      const updated = await tx.logisticsCompany.update({ where: { id: companyId }, data, select: BRAND_SELECT });
      const { headUserId: _h, ...before } = c;
      void _h;
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_COMPANY_BRAND_UPDATE", entityType: "LogisticsCompany", entityId: companyId, before, after: updated });
      return updated;
    });
  },

  async setExternalAccess(actor: Actor, companyId: number, allow: boolean, opts?: Opts) {
    needPlatform(actor);
    return run(opts, async (tx) => {
      const c = await tx.logisticsCompany.findUnique({ where: { id: companyId }, select: { id: true, allowExternalPlatforms: true } });
      if (!c) throw new LogisticsError("الشركة غير موجودة", 404);
      if (c.allowExternalPlatforms === allow) throw new LogisticsError("القيمة الحالية مطابقة", 409);
      if (!allow) {
        const open = await tx.companyPlatformLink.count({ where: { companyId, status: { not: "REVOKED" }, platform: { kind: "EXTERNAL" } } });
        if (open > 0) throw new LogisticsError("يوجد " + open + " ربط بمنصات خارجية غير ملغى، ألغِه أولاً", 409);
      }
      await tx.logisticsCompany.update({ where: { id: companyId }, data: { allowExternalPlatforms: allow } });
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_COMPANY_EXTERNAL_ACCESS", entityType: "LogisticsCompany", entityId: companyId, before: { allowExternalPlatforms: c.allowExternalPlatforms }, after: { allowExternalPlatforms: allow } });
      return { companyId, allowExternalPlatforms: allow };
    });
  },

  async assignDriver(actor: Actor, deliveryPersonId: number, companyId: number, opts?: Opts) {
    needPlatform(actor);
    return run(opts, async (tx) => {
      const dp = await tx.deliveryPerson.findUnique({ where: { id: deliveryPersonId }, select: { id: true, companyId: true, deletedAt: true } });
      if (!dp || dp.deletedAt) throw new LogisticsError("السائق غير موجود", 404);
      const c = await tx.logisticsCompany.findUnique({ where: { id: companyId }, select: { id: true, status: true } });
      if (!c) throw new LogisticsError("الشركة غير موجودة", 404);
      if (c.status !== "ACTIVE") throw new LogisticsError("الشركة غير نشطة", 409);
      if (dp.companyId === companyId) throw new LogisticsError("السائق تابع لهذه الشركة مسبقاً", 409);
      const busy = await tx.shipment.count({ where: { deliveryPersonId: dp.id, status: { in: ACTIVE_DRIVER_SHIPMENT_STATUSES as never } } });
      if (busy > 0) throw new LogisticsError("لدى السائق " + busy + " شحنة نشطة، أنهِها أو أعد إسنادها أولاً", 409);
      await tx.deliveryPerson.update({ where: { id: dp.id }, data: { companyId } });
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_DRIVER_ASSIGN_COMPANY", entityType: "DeliveryPerson", entityId: dp.id, before: { companyId: dp.companyId }, after: { companyId } });
      return { deliveryPersonId: dp.id, companyId };
    });
  },
};