/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { LogisticsError } from "@/lib/logistics-errors";
import { logLogisticsAudit } from "@/lib/logistics-audit";
import { generatePlatformKey, hashPlatformKey, parsePlatformKey, safeEqualHex } from "@/lib/logistics-platform-key";
import { canPlatformTransition } from "@/lib/logistics-tenancy-rules";
import type { PlatformCreateInput, PlatformAction } from "@/lib/logistics-tenancy-validation";
import type { Actor } from "@/services/logistics-admin.service";

type Opts = { tx?: any };

async function run<T>(opts: Opts | undefined, fn: (tx: any) => Promise<T>): Promise<T> {
  if (opts?.tx) return fn(opts.tx);
  return (prisma as any).$transaction(fn, { timeout: 20000 }) as Promise<T>;
}

function needPlatform(actor: Actor) {
  if (!actor.scope.platform) throw new LogisticsError("هذه العملية للأدمن فقط", 403);
}

/** لا يتضمن apiKeyHash أبداً. */
const PUBLIC = {
  id: true,
  code: true,
  name: true,
  kind: true,
  status: true,
  statusReason: true,
  statusChangedAt: true,
  contactEmail: true,
  webhookUrl: true,
  ownerUserId: true,
  notes: true,
  apiKeyPrefix: true,
  apiKeyRotatedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const ClientPlatformService = {
  async list(actor: Actor) {
    needPlatform(actor);
    return prisma.clientPlatform.findMany({
      orderBy: { id: "asc" },
      take: 200,
      select: { ...PUBLIC, _count: { select: { links: true, shipments: true } } },
    });
  },

  async create(actor: Actor, input: PlatformCreateInput, opts?: Opts) {
    needPlatform(actor);
    const code = input.code.toUpperCase();
    const key = generatePlatformKey();
    const platform = await run(opts, async (tx) => {
      const dup = await tx.clientPlatform.findUnique({ where: { code }, select: { id: true } });
      if (dup) throw new LogisticsError("الكود مستخدم مسبقاً", 409);
      if (input.ownerUserId) {
        const u = await tx.user.findUnique({ where: { id: input.ownerUserId }, select: { id: true } });
        if (!u) throw new LogisticsError("المستخدم المالك غير موجود", 404);
      }
      const created = await tx.clientPlatform.create({
        data: {
          code,
          name: input.name,
          kind: "EXTERNAL",
          status: "ACTIVE",
          contactEmail: input.contactEmail ?? null,
          webhookUrl: input.webhookUrl ?? null,
          ownerUserId: input.ownerUserId ?? null,
          notes: input.notes ?? null,
          apiKeyPrefix: key.prefix,
          apiKeyHash: key.hash,
          apiKeyRotatedAt: new Date(),
          createdById: actor.id,
        },
        select: PUBLIC,
      });
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_PLATFORM_CREATE", entityType: "ClientPlatform", entityId: created.id, after: created });
      return created;
    });
    return { platform, apiKey: key.raw as string };
  },

  async act(actor: Actor, id: number, a: PlatformAction, opts?: Opts): Promise<{ platform: any; apiKey?: string }> {
    needPlatform(actor);
    return run(opts, async (tx) => {
      const p = await tx.clientPlatform.findUnique({ where: { id }, select: PUBLIC });
      if (!p) throw new LogisticsError("المنصة غير موجودة", 404);

      if (a.action === "update") {
        const data: Record<string, unknown> = {};
        if (a.name !== undefined) data.name = a.name;
        if (a.contactEmail !== undefined) data.contactEmail = a.contactEmail;
        if (a.webhookUrl !== undefined) data.webhookUrl = a.webhookUrl;
        if (a.ownerUserId !== undefined) data.ownerUserId = a.ownerUserId;
        if (a.notes !== undefined) data.notes = a.notes;
        if (Object.keys(data).length === 0) throw new LogisticsError("لا توجد تغييرات", 400);
        const updated = await tx.clientPlatform.update({ where: { id }, data, select: PUBLIC });
        await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_PLATFORM_UPDATE", entityType: "ClientPlatform", entityId: id, before: p, after: updated });
        return { platform: updated };
      }

      if (a.action === "rotate_key") {
        if (p.kind !== "EXTERNAL") throw new LogisticsError("لا مفتاح للمنصة الداخلية", 409);
        if (p.status !== "ACTIVE") throw new LogisticsError("تدوير المفتاح للمنصة النشطة فقط", 409);
        const key = generatePlatformKey();
        const updated = await tx.clientPlatform.update({ where: { id }, data: { apiKeyPrefix: key.prefix, apiKeyHash: key.hash, apiKeyRotatedAt: new Date() }, select: PUBLIC });
        await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_PLATFORM_ROTATE_KEY", entityType: "ClientPlatform", entityId: id, before: { apiKeyPrefix: p.apiKeyPrefix }, after: { apiKeyPrefix: key.prefix } });
        return { platform: updated, apiKey: key.raw as string };
      }

      const next = a.action === "suspend" ? "SUSPENDED" : a.action === "activate" ? "ACTIVE" : "REVOKED";
      if (p.kind === "OWN" && next !== "ACTIVE") throw new LogisticsError("لا يمكن تعليق أو إلغاء المنصة الداخلية", 409);
      if (!canPlatformTransition(p.status, next)) throw new LogisticsError("انتقال غير مسموح من " + p.status + " إلى " + next, 409);
      const why = a.action === "activate" ? null : a.reason;
      const r = await tx.clientPlatform.updateMany({
        where: { id, status: p.status },
        data: { status: next, statusReason: why, statusChangedAt: new Date(), statusChangedById: actor.id },
      });
      if (r.count === 0) throw new LogisticsError("تغيّرت حالة المنصة من عملية أخرى، أعد المحاولة", 409);
      const updated = await tx.clientPlatform.findUnique({ where: { id }, select: PUBLIC });
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_PLATFORM_" + a.action.toUpperCase(), entityType: "ClientPlatform", entityId: id, before: p, after: updated });
      return { platform: updated };
    });
  },

  /** يتحقق من مفتاح منصة خارجية؛ يعيد null عند أي فشل (لا يكشف السبب). */
  async verifyKey(raw: string, opts?: Opts) {
    const parsed = parsePlatformKey(raw);
    if (!parsed) return null;
    const db = opts?.tx ?? prisma;
    const p = await db.clientPlatform.findUnique({
      where: { apiKeyPrefix: parsed.prefix },
      select: { id: true, code: true, kind: true, status: true, apiKeyHash: true },
    });
    if (!p || p.kind !== "EXTERNAL" || p.status !== "ACTIVE" || !p.apiKeyHash) return null;
    return safeEqualHex(hashPlatformKey(raw.trim()), p.apiKeyHash) ? { platformId: p.id as number, code: p.code as string } : null;
  },
};