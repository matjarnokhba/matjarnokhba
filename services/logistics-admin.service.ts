/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { LogisticsError } from "@/lib/logistics-errors";
import { logLogisticsAudit } from "@/lib/logistics-audit";
import { COMPANY_TRANSITIONS, WAREHOUSE_TRANSITIONS, canTransition, codePart } from "@/lib/logistics-rules";
import { hasJobRole, type ResolvedScope } from "@/lib/logistics-scope";
import type {
  WarehouseCreateInput,
  WarehouseUpdateInput,
  CompanyCreateInput,
  CompanyUpdateInput,
  MembershipCreateInput,
  MembershipUpdateInput,
} from "@/lib/logistics-validation";

export interface Actor {
  id: number;
  scope: ResolvedScope;
}

function requirePlatform(actor: Actor) {
  if (!actor.scope.platform) throw new LogisticsError("غير مصرح", 403);
}

function assertCanManageWarehouse(actor: Actor, warehouseId: number) {
  if (actor.scope.platform) return;
  if (!hasJobRole(actor.scope, warehouseId, "MANAGER")) throw new LogisticsError("غير مصرح", 403);
}

async function assertUserExists(tx: any, userId: number) {
  const u = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!u) throw new LogisticsError("المستخدم غير موجود", 404);
}

async function uniqueCode(tx: any, model: "warehouse" | "logisticsCompany", prefix: string, seed: string) {
  const base = prefix + "-" + codePart(seed);
  for (let i = 1; i <= 99; i++) {
    const code = base + "-" + i;
    const ex = await tx[model].findUnique({ where: { code }, select: { id: true } });
    if (!ex) return code;
  }
  throw new LogisticsError("تعذّر توليد رمز فريد", 409);
}

async function setCompanyHead(tx: any, actorId: number, companyId: number, oldHeadId: number | null, newHeadId: number | null) {
  if (oldHeadId && oldHeadId !== newHeadId) {
    await tx.logisticsMembership.updateMany({
      where: { userId: oldHeadId, scope: "COMPANY", companyId, status: "ACTIVE", jobRoles: { has: "MANAGER" } },
      data: { status: "REVOKED" },
    });
  }
  if (newHeadId) {
    const ex = await tx.logisticsMembership.findFirst({
      where: { userId: newHeadId, scope: "COMPANY", companyId, status: { in: ["ACTIVE", "SUSPENDED"] } },
    });
    if (ex) {
      const roles: string[] = Array.from(new Set([...(ex.jobRoles as string[]), "MANAGER"]));
      await tx.logisticsMembership.update({ where: { id: ex.id }, data: { status: "ACTIVE", jobRoles: roles } });
    } else {
      await tx.logisticsMembership.create({
        data: { userId: newHeadId, scope: "COMPANY", companyId, jobRoles: ["MANAGER"], appointedById: actorId, notes: "company head" },
      });
    }
  }
}

export const LogisticsAdminService = {
  // ───────────── Warehouses ─────────────
  async listWarehouses(companyId?: number) {
    const rows = await prisma.warehouse.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { id: "asc" },
      include: {
        company: { select: { id: true, name: true, code: true, kind: true, status: true } },
        _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
      },
    });
    const mgrIds = Array.from(new Set(rows.map((r) => r.managerUserId).filter((x): x is number => x != null)));
    const mgrs = mgrIds.length
      ? await prisma.user.findMany({ where: { id: { in: mgrIds } }, select: { id: true, name: true, phone: true } })
      : [];
    const byId = new Map(mgrs.map((m) => [m.id, m]));
    return rows.map((r) => ({ ...r, manager: r.managerUserId ? byId.get(r.managerUserId) ?? null : null }));
  },

  async createWarehouse(actor: Actor, input: WarehouseCreateInput) {
    requirePlatform(actor);
    return prisma.$transaction(async (tx: any) => {
      const company = await tx.logisticsCompany.findUnique({ where: { id: input.companyId } });
      if (!company) throw new LogisticsError("الشركة غير موجودة", 404);
      if (company.status === "DETACHED" || company.status === "DETACHING") {
        throw new LogisticsError("لا يمكن إضافة مستودع لشركة مفصولة أو قيد الفصل", 409);
      }
      let code = input.code;
      if (code) {
        const ex = await tx.warehouse.findUnique({ where: { code }, select: { id: true } });
        if (ex) throw new LogisticsError("رمز المستودع مستعمل", 409);
      } else {
        code = await uniqueCode(tx, "warehouse", "WH", input.city);
      }
      const created = await tx.warehouse.create({
        data: {
          code,
          name: input.name,
          companyId: input.companyId,
          city: input.city,
          district: input.district,
          address: input.address,
          latitude: input.latitude,
          longitude: input.longitude,
          capacity: input.capacity,
        },
      });
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_WAREHOUSE_CREATE", entityType: "Warehouse", entityId: created.id, after: created });
      return created;
    });
  },

  async updateWarehouse(actor: Actor, id: number, patch: WarehouseUpdateInput) {
    requirePlatform(actor);
    return prisma.$transaction(async (tx: any) => {
      const before = await tx.warehouse.findUnique({ where: { id } });
      if (!before) throw new LogisticsError("المستودع غير موجود", 404);
      if (patch.status && patch.status !== before.status) {
        if (!canTransition(WAREHOUSE_TRANSITIONS, before.status, patch.status)) {
          throw new LogisticsError("انتقال حالة غير مسموح", 409);
        }
        if (before.isDefault && patch.status !== "ACTIVE") {
          throw new LogisticsError("لا يمكن إيقاف أو إغلاق المستودع الافتراضي", 409);
        }
      }
      const after = await tx.warehouse.update({ where: { id }, data: patch });
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_WAREHOUSE_UPDATE", entityType: "Warehouse", entityId: id, before, after });
      return after;
    });
  },

  // ───────────── Companies ─────────────
  async listCompanies() {
    const rows = await prisma.logisticsCompany.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { warehouses: true } } },
    });
    const headIds = Array.from(new Set(rows.map((r) => r.headUserId).filter((x): x is number => x != null)));
    const heads = headIds.length
      ? await prisma.user.findMany({ where: { id: { in: headIds } }, select: { id: true, name: true, phone: true } })
      : [];
    const byId = new Map(heads.map((h) => [h.id, h]));
    return rows.map((r) => ({ ...r, head: r.headUserId ? byId.get(r.headUserId) ?? null : null }));
  },

  async createCompany(actor: Actor, input: CompanyCreateInput) {
    requirePlatform(actor);
    return prisma.$transaction(async (tx: any) => {
      if (input.headUserId) await assertUserExists(tx, input.headUserId);
      let code = input.code;
      if (code) {
        const ex = await tx.logisticsCompany.findUnique({ where: { code }, select: { id: true } });
        if (ex) throw new LogisticsError("رمز الشركة مستعمل", 409);
      } else {
        code = await uniqueCode(tx, "logisticsCompany", "LC", input.name);
      }
      const created = await tx.logisticsCompany.create({
        data: { code, name: input.name, kind: input.kind, headUserId: input.headUserId ?? null, createdById: actor.id },
      });
      if (input.headUserId) await setCompanyHead(tx, actor.id, created.id, null, input.headUserId);
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_COMPANY_CREATE", entityType: "LogisticsCompany", entityId: created.id, after: created });
      return created;
    });
  },

  async updateCompany(actor: Actor, id: number, patch: CompanyUpdateInput) {
    requirePlatform(actor);
    return prisma.$transaction(async (tx: any) => {
      const before = await tx.logisticsCompany.findUnique({ where: { id } });
      if (!before) throw new LogisticsError("الشركة غير موجودة", 404);
      if (patch.status && patch.status !== before.status) {
        if (!canTransition(COMPANY_TRANSITIONS, before.status, patch.status)) {
          throw new LogisticsError("انتقال حالة غير مسموح", 409);
        }
        if (patch.status === "DETACHING" || patch.status === "DETACHED") {
          const owns = await tx.warehouse.findFirst({ where: { companyId: id, isDefault: true }, select: { id: true } });
          if (owns) throw new LogisticsError("هذه الشركة تملك المستودع الافتراضي ولا يمكن فصلها", 409);
        }
      }
      if (patch.headUserId) await assertUserExists(tx, patch.headUserId);
      const data: Record<string, unknown> = {};
      if (patch.name !== undefined) data.name = patch.name;
      if (patch.status !== undefined) data.status = patch.status;
      if (patch.headUserId !== undefined) data.headUserId = patch.headUserId;
      const after = await tx.logisticsCompany.update({ where: { id }, data });
      if (patch.headUserId !== undefined && patch.headUserId !== before.headUserId) {
        await setCompanyHead(tx, actor.id, id, before.headUserId, patch.headUserId);
      }
      await logLogisticsAudit(tx, {
        userId: actor.id,
        action: patch.status && patch.status !== before.status ? "LOGISTICS_COMPANY_STATUS" : "LOGISTICS_COMPANY_UPDATE",
        entityType: "LogisticsCompany",
        entityId: id,
        before,
        after,
      });
      return after;
    });
  },

  // ───────────── Memberships ─────────────
  async listMemberships(actor: Actor, filters: { warehouseId?: number; companyId?: number; userId?: number; status?: string }) {
    const where: Record<string, unknown> = {};
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.companyId) where.companyId = filters.companyId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;
    if (!actor.scope.platform) {
      where.scope = "WAREHOUSE";
      where.warehouseId = filters.warehouseId && actor.scope.warehouseIds.includes(filters.warehouseId)
        ? filters.warehouseId
        : { in: actor.scope.warehouseIds };
    }
    return prisma.logisticsMembership.findMany({
      where: where as never,
      orderBy: { id: "desc" },
      take: 500,
      include: {
        user: { select: { id: true, name: true, phone: true, role: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        company: { select: { id: true, name: true, code: true } },
      },
    });
  },

  async appointMembership(actor: Actor, input: MembershipCreateInput) {
    return prisma.$transaction(async (tx: any) => {
      const roles: string[] = Array.from(new Set(input.jobRoles as string[]));
      if (input.scope !== "WAREHOUSE") requirePlatform(actor);
      await assertUserExists(tx, input.userId);

      let companyId: number | null = input.companyId ?? null;
      let warehouseId: number | null = null;

      if (input.scope === "WAREHOUSE") {
        warehouseId = input.warehouseId as number;
        const wh = await tx.warehouse.findUnique({ where: { id: warehouseId } });
        if (!wh) throw new LogisticsError("المستودع غير موجود", 404);
        if (wh.status !== "ACTIVE") throw new LogisticsError("المستودع غير نشط", 409);
        assertCanManageWarehouse(actor, warehouseId);
        if (!actor.scope.platform && roles.includes("MANAGER")) {
          throw new LogisticsError("تعيين المدير من صلاحية الإدارة فقط", 403);
        }
        companyId = wh.companyId;
      } else if (input.scope === "COMPANY") {
        const c = await tx.logisticsCompany.findUnique({ where: { id: companyId as number }, select: { id: true } });
        if (!c) throw new LogisticsError("الشركة غير موجودة", 404);
      }

      const dup = await tx.logisticsMembership.findFirst({
        where: { userId: input.userId, scope: input.scope, companyId, warehouseId, status: { in: ["ACTIVE", "SUSPENDED"] } },
        select: { id: true },
      });
      if (dup) throw new LogisticsError("للمستخدم عضوية قائمة في هذا النطاق، عدّلها بدل إنشاء جديدة", 409);

      const isWarehouseManager = input.scope === "WAREHOUSE" && roles.includes("MANAGER");
      if (isWarehouseManager) {
        const other = await tx.logisticsMembership.findFirst({
          where: { scope: "WAREHOUSE", warehouseId, status: "ACTIVE", jobRoles: { has: "MANAGER" } },
          select: { id: true },
        });
        if (other) throw new LogisticsError("لهذا المستودع مدير بالفعل", 409);
      }

      const created = await tx.logisticsMembership.create({
        data: { userId: input.userId, scope: input.scope, companyId, warehouseId, jobRoles: roles, appointedById: actor.id, notes: input.notes },
      });
      if (isWarehouseManager) {
        await tx.warehouse.update({ where: { id: warehouseId as number }, data: { managerUserId: input.userId } });
      }
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_MEMBERSHIP_APPOINT", entityType: "LogisticsMembership", entityId: created.id, after: created });
      return created;
    });
  },

  async updateMembership(actor: Actor, id: number, patch: MembershipUpdateInput) {
    return prisma.$transaction(async (tx: any) => {
      const before = await tx.logisticsMembership.findUnique({ where: { id } });
      if (!before) throw new LogisticsError("العضوية غير موجودة", 404);

      if (before.scope === "WAREHOUSE") {
        assertCanManageWarehouse(actor, before.warehouseId as number);
      } else {
        requirePlatform(actor);
      }

      const newRoles: string[] = patch.jobRoles ? Array.from(new Set(patch.jobRoles as string[])) : (before.jobRoles as string[]);
      const newStatus: string = patch.status ?? before.status;
      const wasManager = before.scope === "WAREHOUSE" && before.status === "ACTIVE" && (before.jobRoles as string[]).includes("MANAGER");
      const willBeManager = before.scope === "WAREHOUSE" && newStatus === "ACTIVE" && newRoles.includes("MANAGER");

      if (before.scope === "WAREHOUSE" && !actor.scope.platform) {
        if (willBeManager !== wasManager || before.userId === actor.id) {
          throw new LogisticsError("تعديل المدير من صلاحية الإدارة فقط", 403);
        }
      }
      if (willBeManager && !wasManager) {
        const other = await tx.logisticsMembership.findFirst({
          where: { scope: "WAREHOUSE", warehouseId: before.warehouseId, status: "ACTIVE", jobRoles: { has: "MANAGER" }, NOT: { id } },
          select: { id: true },
        });
        if (other) throw new LogisticsError("لهذا المستودع مدير بالفعل", 409);
      }

      const data: Record<string, unknown> = {};
      if (patch.status !== undefined) data.status = patch.status;
      if (patch.jobRoles !== undefined) data.jobRoles = newRoles;
      if (patch.notes !== undefined) data.notes = patch.notes;
      const after = await tx.logisticsMembership.update({ where: { id }, data });

      if (willBeManager && !wasManager) {
        await tx.warehouse.update({ where: { id: before.warehouseId }, data: { managerUserId: before.userId } });
      } else if (wasManager && !willBeManager) {
        await tx.warehouse.updateMany({ where: { id: before.warehouseId, managerUserId: before.userId }, data: { managerUserId: null } });
      }

      await logLogisticsAudit(tx, {
        userId: actor.id,
        action: patch.status === "REVOKED" ? "LOGISTICS_MEMBERSHIP_REVOKE" : "LOGISTICS_MEMBERSHIP_UPDATE",
        entityType: "LogisticsMembership",
        entityId: id,
        before,
        after,
      });
      return after;
    });
  },

  // ───────────── Audit ─────────────
  async listAudit(filters: { entityType?: string; entityId?: number }) {
    const where: Record<string, unknown> = {
      entityType: filters.entityType ? filters.entityType : { in: ["Warehouse", "LogisticsCompany", "LogisticsMembership", "WarehouseTransfer", "ClientPlatform", "CompanyPlatformLink", "DeliveryPerson", "ShippingProvider"] },
    };
    if (filters.entityId) where.entityId = filters.entityId;
    const rows = await prisma.operationAuditLog.findMany({ where: where as never, orderBy: { createdAt: "desc" }, take: 200 });
    const ids = Array.from(new Set(rows.map((r) => r.userId).filter((x): x is number => x != null)));
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    const byId = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({ ...r, actorName: r.userId ? byId.get(r.userId) ?? null : null }));
  },
};