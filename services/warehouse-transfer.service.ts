/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { LogisticsError } from "@/lib/logistics-errors";
import { logLogisticsAudit } from "@/lib/logistics-audit";
import { ParcelMovementService } from "@/services/parcel-movement.service";
import { hasJobRole, type ResolvedScope } from "@/lib/logistics-scope";
import {
  TRANSFERABLE_ITEM_STATUSES,
  SOURCE_ROLES,
  DEST_ROLES,
  canTransferTransition,
  evaluateReceipt,
} from "@/lib/logistics-transfer-rules";
import type { TransferAction, TransferCreateInput } from "@/lib/logistics-transfer-validation";
import type { Actor } from "@/services/logistics-admin.service";

type Opts = { tx?: any };

async function run<T>(opts: Opts | undefined, fn: (tx: any) => Promise<T>): Promise<T> {
  if (opts?.tx) return fn(opts.tx);
  return (prisma as any).$transaction(fn, { timeout: 20000 }) as Promise<T>;
}

function canAct(scope: ResolvedScope, warehouseId: number, roles: string[]): boolean {
  return scope.platform || roles.some((r) => hasJobRole(scope, warehouseId, r));
}

function need(ok: boolean, message = "غير مصرح", status = 403) {
  if (!ok) throw new LogisticsError(message, status);
}

async function generateNumber(tx: any): Promise<string> {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  for (let i = 0; i < 20; i++) {
    const n = "TRF-" + day + "-" + Math.floor(1000 + Math.random() * 9000);
    const ex = await tx.warehouseTransfer.findUnique({ where: { transferNumber: n }, select: { id: true } });
    if (!ex) return n;
  }
  throw new LogisticsError("تعذّر توليد رقم النقل", 409);
}

async function validateItems(tx: any, ids: number[], fromId: number) {
  const uniq = Array.from(new Set(ids));
  const items = await tx.fulfillmentItem.findMany({
    where: { id: { in: uniq } },
    select: { id: true, quantity: true, status: true, warehouseRefId: true },
  });
  if (items.length !== uniq.length) throw new LogisticsError("بعض العناصر غير موجودة", 404);
  const bad = items.filter((i: any) => i.warehouseRefId !== fromId || !TRANSFERABLE_ITEM_STATUSES.includes(i.status));
  if (bad.length) {
    throw new LogisticsError("العناصر " + bad.map((i: any) => i.id).join(",") + " ليست في المستودع المصدر أو حالتها لا تسمح بالنقل", 409);
  }
  const busy = await tx.warehouseTransferItem.findMany({
    where: { fulfillmentItemId: { in: uniq }, active: true },
    select: { fulfillmentItemId: true },
  });
  if (busy.length) {
    throw new LogisticsError("العناصر " + busy.map((b: any) => b.fulfillmentItemId).join(",") + " ضمن عملية نقل نشطة أخرى", 409);
  }
  return items as { id: number; quantity: number }[];
}

const transferInclude = {
  fromWarehouse: { select: { id: true, name: true, code: true, companyId: true } },
  toWarehouse: { select: { id: true, name: true, code: true, companyId: true } },
  items: {
    orderBy: { id: "asc" },
    include: {
      fulfillmentItem: {
        select: {
          id: true,
          status: true,
          warehouseRefId: true,
          orderItem: { select: { product: { select: { name: true } }, order: { select: { orderNumber: true } } } },
        },
      },
    },
  },
  discrepancies: { orderBy: { id: "asc" } },
} as const;

export const WarehouseTransferService = {
  async create(actor: Actor, input: TransferCreateInput, opts?: Opts) {
    const id = await run(opts, async (tx) => {
      if (input.fromWarehouseId === input.toWarehouseId) throw new LogisticsError("المصدر والوجهة متطابقان", 400);
      need(canAct(actor.scope, input.fromWarehouseId, SOURCE_ROLES));
      const [from, to] = await Promise.all([
        tx.warehouse.findUnique({ where: { id: input.fromWarehouseId }, select: { id: true, companyId: true, status: true } }),
        tx.warehouse.findUnique({ where: { id: input.toWarehouseId }, select: { id: true, companyId: true, status: true } }),
      ]);
      if (!from || !to) throw new LogisticsError("مستودع غير موجود", 404);
      if (from.status !== "ACTIVE" || to.status !== "ACTIVE") throw new LogisticsError("المستودعان يجب أن يكونا نشطين", 409);
      const items = await validateItems(tx, input.fulfillmentItemIds, from.id);
      const requiresApproval = from.companyId !== to.companyId;
      const t = await tx.warehouseTransfer.create({
        data: {
          transferNumber: await generateNumber(tx),
          fromWarehouseId: from.id,
          toWarehouseId: to.id,
          reason: input.reason,
          notes: input.notes ?? null,
          requiresApproval,
          createdById: actor.id,
        },
      });
      for (const it of items) {
        await tx.warehouseTransferItem.create({ data: { transferId: t.id, fulfillmentItemId: it.id, expectedQuantity: it.quantity } });
      }
      await ParcelMovementService.record(tx, { entityType: "TRANSFER", entityId: t.id, action: "TRANSFER_CREATE", toStatus: "DRAFT", fromWarehouseId: from.id, toWarehouseId: to.id, actorId: actor.id, reason: input.reason });
      await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_TRANSFER_CREATE", entityType: "WarehouseTransfer", entityId: t.id, after: { ...t, itemIds: items.map((i) => i.id) } });
      return t.id as number;
    });
    return this.get(actor, id, opts);
  },

  async get(actor: Actor, id: number, opts?: Opts) {
    const db = opts?.tx ?? prisma;
    const t = await db.warehouseTransfer.findUnique({ where: { id }, include: transferInclude });
    if (!t) throw new LogisticsError("النقل غير موجود", 404);
    need(actor.scope.platform || actor.scope.warehouseIds.includes(t.fromWarehouseId) || actor.scope.warehouseIds.includes(t.toWarehouseId));
    return t;
  },

  async list(actor: Actor, f: { status?: string; warehouseId?: number }) {
    const where: Record<string, unknown> = {};
    if (f.status) where.status = f.status;
    const wh = f.warehouseId ? [f.warehouseId] : null;
    if (!actor.scope.platform) {
      const allowed = actor.scope.warehouseIds.filter((w) => !wh || wh.includes(w));
      where.OR = [{ fromWarehouseId: { in: allowed } }, { toWarehouseId: { in: allowed } }];
    } else if (wh) {
      where.OR = [{ fromWarehouseId: wh[0] }, { toWarehouseId: wh[0] }];
    }
    return prisma.warehouseTransfer.findMany({
      where: where as never,
      orderBy: { id: "desc" },
      take: 200,
      include: {
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        _count: { select: { items: true, discrepancies: true } },
      },
    });
  },

  async eligibleItems(actor: Actor, warehouseId: number) {
    need(canAct(actor.scope, warehouseId, SOURCE_ROLES));
    return prisma.fulfillmentItem.findMany({
      where: {
        warehouseRefId: warehouseId,
        status: { in: TRANSFERABLE_ITEM_STATUSES as never },
        transferItems: { none: { active: true } },
      },
      orderBy: { id: "desc" },
      take: 200,
      select: {
        id: true,
        quantity: true,
        status: true,
        orderItem: { select: { product: { select: { name: true } }, order: { select: { orderNumber: true } } } },
      },
    });
  },

  async act(actor: Actor, id: number, a: TransferAction, opts?: Opts) {
    await run(opts, async (tx) => {
      const t = await tx.warehouseTransfer.findUnique({
        where: { id },
        include: { items: true, fromWarehouse: { select: { companyId: true } }, toWarehouse: { select: { companyId: true } } },
      });
      if (!t) throw new LogisticsError("النقل غير موجود", 404);
      const from: number = t.fromWarehouseId;
      const to: number = t.toWarehouseId;
      const activeItems = t.items.filter((i: any) => i.active);

      const setStatus = async (next: string, data: Record<string, unknown>, action: string) => {
        if (!canTransferTransition(t.status, next)) throw new LogisticsError("انتقال غير مسموح من " + t.status + " إلى " + next, 409);
        const r = await tx.warehouseTransfer.updateMany({ where: { id, status: t.status }, data: { status: next, ...data } });
        if (r.count === 0) throw new LogisticsError("تغيّرت حالة النقل من عملية أخرى، أعد المحاولة", 409);
        await ParcelMovementService.record(tx, { entityType: "TRANSFER", entityId: id, action: "TRANSFER_" + action, fromStatus: t.status, toStatus: next, fromWarehouseId: from, toWarehouseId: to, actorId: actor.id });
        await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_TRANSFER_" + action, entityType: "WarehouseTransfer", entityId: id, before: { status: t.status }, after: { status: next, ...data } });
      };

      switch (a.action) {
        case "add_items": {
          need(canAct(actor.scope, from, SOURCE_ROLES));
          if (t.status !== "DRAFT") throw new LogisticsError("يمكن تعديل العناصر في المسودة فقط", 409);
          const items = await validateItems(tx, a.fulfillmentItemIds, from);
          for (const it of items) {
            const ex = t.items.find((x: any) => x.fulfillmentItemId === it.id);
            if (ex) await tx.warehouseTransferItem.update({ where: { id: ex.id }, data: { active: true, outcome: "PENDING", note: null } });
            else await tx.warehouseTransferItem.create({ data: { transferId: id, fulfillmentItemId: it.id, expectedQuantity: it.quantity } });
          }
          await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_TRANSFER_ADD_ITEMS", entityType: "WarehouseTransfer", entityId: id, after: { itemIds: items.map((i) => i.id) } });
          break;
        }
        case "remove_items": {
          need(canAct(actor.scope, from, SOURCE_ROLES));
          if (t.status !== "DRAFT") throw new LogisticsError("يمكن تعديل العناصر في المسودة فقط", 409);
          const targets = activeItems.filter((i: any) => a.fulfillmentItemIds.includes(i.fulfillmentItemId));
          if (targets.length !== new Set(a.fulfillmentItemIds).size) throw new LogisticsError("بعض العناصر ليست ضمن النقل", 400);
          await tx.warehouseTransferItem.updateMany({ where: { id: { in: targets.map((x: any) => x.id) } }, data: { active: false, note: "removed from draft" } });
          await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_TRANSFER_REMOVE_ITEMS", entityType: "WarehouseTransfer", entityId: id, after: { itemIds: a.fulfillmentItemIds } });
          break;
        }
        case "prepare": {
          need(canAct(actor.scope, from, SOURCE_ROLES));
          if (t.status !== "DRAFT") throw new LogisticsError("التجهيز من المسودة فقط", 409);
          if (activeItems.length === 0) throw new LogisticsError("لا توجد عناصر في النقل", 400);
          await setStatus(t.requiresApproval ? "PENDING_APPROVAL" : "PREPARED", { preparedById: actor.id, preparedAt: new Date() }, "PREPARE");
          break;
        }
        case "approve": {
          need(actor.scope.platform);
          if (t.status !== "PENDING_APPROVAL") throw new LogisticsError("لا يوجد طلب موافقة", 409);
          await setStatus("PREPARED", { approvedById: actor.id, approvedAt: new Date() }, "APPROVE");
          break;
        }
        case "dispatch": {
          need(canAct(actor.scope, from, SOURCE_ROLES));
          if (t.status !== "PREPARED") throw new LogisticsError("الإرسال من حالة (مجهّزة) فقط", 409);
          const drv = await tx.logisticsMembership.findFirst({
            where: {
              userId: a.driverUserId,
              status: "ACTIVE",
              jobRoles: { has: "TRANSFER_DRIVER" },
              OR: [{ scope: "WAREHOUSE", warehouseId: from }, { scope: "COMPANY", companyId: t.fromWarehouse.companyId }, { scope: "PLATFORM" }],
            },
            select: { id: true },
          });
          if (!drv) throw new LogisticsError("السائق ليس معيّناً كسائق نقل في المستودع المصدر", 400);
          for (const it of activeItems) {
            await ParcelMovementService.record(tx, { entityType: "FULFILLMENT_ITEM", entityId: it.fulfillmentItemId, action: "TRANSFER_DISPATCHED", fromWarehouseId: from, toWarehouseId: to, actorId: actor.id, metadata: { transferId: id, driverUserId: a.driverUserId } });
          }
          await setStatus("DISPATCHED", { dispatchedById: actor.id, dispatchedAt: new Date(), driverUserId: a.driverUserId }, "DISPATCH");
          break;
        }
        case "receive": {
          need(canAct(actor.scope, to, DEST_ROLES));
          if (t.status !== "DISPATCHED") throw new LogisticsError("الاستلام من حالة (مُرسَلة) فقط", 409);
          const byId = new Map<number, (typeof a.items)[number]>(a.items.map((i) => [i.fulfillmentItemId, i]));
          if (byId.size !== a.items.length) throw new LogisticsError("عنصر مكرر في الاستلام", 400);
          if (activeItems.length !== byId.size || activeItems.some((i: any) => !byId.has(i.fulfillmentItemId))) {
            throw new LogisticsError("يجب تحديد نتيجة كل عنصر في النقل", 400);
          }
          let hasDiscrepancy = false;
          for (const it of activeItems) {
            const o = byId.get(it.fulfillmentItemId)!;
            const ev = evaluateReceipt(it.expectedQuantity, o.outcome, o.receivedQuantity);
            if (!ev.ok) throw new LogisticsError(ev.message, 400);
            await tx.warehouseTransferItem.update({ where: { id: it.id }, data: { outcome: ev.outcome, receivedQuantity: ev.receivedQuantity, note: o.note ?? null, active: false } });
            if (ev.outcome !== "MISSING") {
              await tx.fulfillmentItem.update({ where: { id: it.fulfillmentItemId }, data: { warehouseRefId: to } });
            }
            if (ev.discrepancy) {
              hasDiscrepancy = true;
              await tx.transferDiscrepancy.create({ data: { transferId: id, fulfillmentItemId: it.fulfillmentItemId, type: ev.discrepancy.type, expectedQty: ev.discrepancy.expectedQty, actualQty: ev.discrepancy.actualQty, note: o.note ?? null, reportedById: actor.id } });
            }
            await ParcelMovementService.record(tx, { entityType: "FULFILLMENT_ITEM", entityId: it.fulfillmentItemId, action: ev.outcome === "MISSING" ? "TRANSFER_MISSING" : "TRANSFER_RECEIVED", fromWarehouseId: from, toWarehouseId: ev.outcome === "MISSING" ? null : to, actorId: actor.id, reason: o.note ?? null, metadata: { transferId: id, outcome: ev.outcome } });
          }
          await setStatus(hasDiscrepancy ? "RECEIVED_WITH_DISCREPANCY" : "RECEIVED", { receivedById: actor.id, receivedAt: new Date(), receiptProofUrl: a.receiptProofUrl ?? null, receiptNote: a.note ?? null }, "RECEIVE");
          break;
        }
        case "resolve_discrepancy": {
          need(actor.scope.platform);
          const d = await tx.transferDiscrepancy.findUnique({ where: { id: a.discrepancyId } });
          if (!d || d.transferId !== id) throw new LogisticsError("الفرق غير موجود", 404);
          if (d.resolvedAt) throw new LogisticsError("الفرق محسوم مسبقاً", 409);
          const r = await tx.transferDiscrepancy.updateMany({ where: { id: d.id, resolvedAt: null }, data: { resolvedAt: new Date(), resolvedById: actor.id, resolutionNote: a.note } });
          if (r.count === 0) throw new LogisticsError("تم حسم الفرق من عملية أخرى", 409);
          await logLogisticsAudit(tx, { userId: actor.id, action: "LOGISTICS_TRANSFER_RESOLVE_DISCREPANCY", entityType: "WarehouseTransfer", entityId: id, before: d, after: { discrepancyId: d.id, note: a.note } });
          break;
        }
        case "close": {
          need(actor.scope.platform || hasJobRole(actor.scope, to, "MANAGER"));
          if (t.status !== "RECEIVED" && t.status !== "RECEIVED_WITH_DISCREPANCY") throw new LogisticsError("الإغلاق بعد الاستلام فقط", 409);
          const open = await tx.transferDiscrepancy.count({ where: { transferId: id, resolvedAt: null } });
          if (open > 0) throw new LogisticsError("يوجد " + open + " فرق غير محسوم", 409);
          await setStatus("CLOSED", { closedById: actor.id, closedAt: new Date() }, "CLOSE");
          break;
        }
        case "cancel": {
          need(canAct(actor.scope, from, SOURCE_ROLES));
          if (!["DRAFT", "PENDING_APPROVAL", "PREPARED"].includes(t.status)) throw new LogisticsError("لا يمكن الإلغاء بعد الإرسال", 409);
          await tx.warehouseTransferItem.updateMany({ where: { transferId: id, active: true }, data: { active: false } });
          await setStatus("CANCELLED", { cancelledById: actor.id, cancelledAt: new Date(), cancelReason: a.reason }, "CANCEL");
          break;
        }
      }
    });
    return this.get(actor, id, opts);
  },
};