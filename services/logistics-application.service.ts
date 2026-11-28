/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { LogisticsError } from "@/lib/logistics-errors";
import { logLogisticsAudit } from "@/lib/logistics-audit";
import type { Actor } from "@/services/logistics-admin.service";
import type { CompanyApplyInput } from "@/lib/logistics-application-validation";

type Opts = { tx?: any };

async function run<T>(opts: Opts | undefined, fn: (tx: any) => Promise<T>): Promise<T> {
  if (opts?.tx) return fn(opts.tx);
  return (prisma as any).$transaction(fn, { timeout: 20000 }) as Promise<T>;
}

function needPlatform(actor: Actor) {
  if (!actor.scope.platform) throw new LogisticsError("هذه العملية للأدمن فقط", 403);
}

export const LogisticsApplicationService = {
  /** تسجيل ذاتي: حساب جديد + شركة قيد المراجعة. لا عضوية قبل موافقة الأدمن، فلا صلاحيات. */
  async apply(input: CompanyApplyInput, opts?: Opts) {
    const db = opts?.tx ?? (prisma as any);
    const email = input.email.toLowerCase().trim();
    const exists = await db.user.findUnique({ where: { email }, select: { id: true, deletedAt: true } });
    if (exists && !exists.deletedAt) {
      throw new LogisticsError("البريد الإلكتروني مستخدم بالفعل. سجّل الدخول بحسابك وتواصل مع الإدارة لربط شركتك", 409);
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    return run(opts, async (tx) => {
      const user = await tx.user.create({ data: { name: input.name, email, passwordHash, role: "CUSTOMER" }, select: { id: true, name: true, email: true } });
      const company = await tx.logisticsCompany.create({
        data: {
          code: "LC-" + crypto.randomBytes(4).toString("hex").toUpperCase(),
          name: input.companyName,
          kind: "INTERNAL",
          status: "PENDING",
          headUserId: user.id,
          contactPhone: input.phone,
          contactEmail: email,
          createdById: user.id,
          settings: { application: { city: input.city ?? null, note: input.note ?? null, appliedAt: new Date().toISOString() } },
        },
        select: { id: true, code: true, name: true, status: true },
      });
      await logLogisticsAudit(tx, { userId: user.id, action: "LOGISTICS_COMPANY_APPLY", entityType: "LogisticsCompany", entityId: company.id, after: company });
      return { user, company };
    });
  },

  async listApplications(actor: Actor, opts?: Opts) {
    needPlatform(actor);
    const db = opts?.tx ?? (prisma as any);
    const companies = await db.logisticsCompany.findMany({
      where: { status: { in: ["PENDING", "REJECTED"] } },
      orderBy: { id: "desc" },
      take: 100,
      select: { id: true, code: true, name: true, status: true, headUserId: true, contactPhone: true, contactEmail: true, settings: true, createdAt: true },
    });
    const ids = companies.map((c: any) => c.headUserId).filter((x: any) => x != null);
    const users = ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : [];
    const byId = new Map<number, any>(users.map((u: any) => [u.id, u]));
    return companies.map((c: any) => ({ ...c, head: c.headUserId ? byId.get(c.headUserId) ?? null : null }));
  },

  /** قبول الطلب: تُفعَّل الشركة وتُنشأ عضوية رئيسها (مدير الشركة). */
  async approve(actor: Actor, companyId: number, opts?: Opts) {
    needPlatform(actor);
    return run(opts, async (tx) => {
      const c = await tx.logisticsCompany.findUnique({ where: { id: companyId } });
      if (!c) throw new LogisticsError("الشركة غير موجودة", 404);
      if (c.status !== "PENDING") throw new LogisticsError("هذا الطلب ليس قيد المراجعة", 409);
      if (!c.headUserId) throw new LogisticsError("لا يوجد صاحب للطلب", 409);
      const after = await tx.logisticsCompany.update({ where: { id: companyId }, data: { status: "ACTIVE" } });
      const ex = await tx.logisticsMembership.findFirst({
        where: { userId: c.headUserId, scope: "COMPANY", companyId, status: { in: ["ACTIVE", "SUSPENDED"] } },
      });
      if (ex) {
        const roles: string[] = Array.from(new Set([...(ex.jobRoles as string[]), "MANAGER"]));
        await tx.logisticsMembership.update({ where: { id: ex.id }, data: { status: "ACTIVE", jobRoles: roles } });
      } else {
        await tx.logisticsMembership.create({
          data: { userId: c.headUserId, scope: "COMPANY", companyId, jobRoles: ["MANAGER"], appointedById: actor.id, notes: "company head (approved application)" },
        });
      }
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_COMPANY_APPROVE", entityType: "LogisticsCompany", entityId: companyId, before: c, after });
      return after;
    });
  },

  async reject(actor: Actor, companyId: number, reason: string | null | undefined, opts?: Opts) {
    needPlatform(actor);
    return run(opts, async (tx) => {
      const c = await tx.logisticsCompany.findUnique({ where: { id: companyId } });
      if (!c) throw new LogisticsError("الشركة غير موجودة", 404);
      if (c.status !== "PENDING") throw new LogisticsError("هذا الطلب ليس قيد المراجعة", 409);
      const prev = c.settings && typeof c.settings === "object" ? (c.settings as any) : {};
      const settings = { ...prev, application: { ...(prev.application ?? {}), rejectedReason: reason ?? null, rejectedAt: new Date().toISOString() } };
      const after = await tx.logisticsCompany.update({ where: { id: companyId }, data: { status: "REJECTED", settings } });
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_COMPANY_REJECT", entityType: "LogisticsCompany", entityId: companyId, before: c, after });
      return after;
    });
  },
};
