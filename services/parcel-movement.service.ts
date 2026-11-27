/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";

export type ParcelEntityType = "FULFILLMENT_ITEM" | "SHIPMENT" | "TRANSFER";

export const ParcelMovementService = {
  /** تسجيل حركة يدوية (مثلاً أحداث النقل بين المستودعات). حركات الحالة تُسجَّل تلقائياً بـtriggers. */
  async record(
    tx: any,
    e: {
      entityType: ParcelEntityType;
      entityId: number;
      action: string;
      fromStatus?: string | null;
      toStatus?: string | null;
      fromWarehouseId?: number | null;
      toWarehouseId?: number | null;
      actorId?: number | null;
      reason?: string | null;
      metadata?: unknown;
    }
  ) {
    return tx.parcelMovement.create({
      data: {
        entityType: e.entityType,
        entityId: e.entityId,
        action: e.action,
        fromStatus: e.fromStatus ?? null,
        toStatus: e.toStatus ?? null,
        fromWarehouseId: e.fromWarehouseId ?? null,
        toWarehouseId: e.toWarehouseId ?? null,
        actorId: e.actorId ?? null,
        reason: e.reason ?? null,
        metadata: e.metadata === undefined ? undefined : JSON.parse(JSON.stringify(e.metadata)),
      },
    });
  },

  async list(f: { entityType?: string; entityId?: number; warehouseId?: number }) {
    const where: Record<string, unknown> = {};
    if (f.entityType) where.entityType = f.entityType;
    if (f.entityId) where.entityId = f.entityId;
    if (f.warehouseId) where.OR = [{ fromWarehouseId: f.warehouseId }, { toWarehouseId: f.warehouseId }];
    const rows = await prisma.parcelMovement.findMany({
      where: where as never,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const whIds = Array.from(
      new Set(rows.flatMap((r) => [r.fromWarehouseId, r.toWarehouseId]).filter((x): x is number => x != null))
    );
    const userIds = Array.from(new Set(rows.map((r) => r.actorId).filter((x): x is number => x != null)));
    const [whs, users] = await Promise.all([
      whIds.length ? prisma.warehouse.findMany({ where: { id: { in: whIds } }, select: { id: true, name: true } }) : [],
      userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [],
    ]);
    const wName = new Map(whs.map((w) => [w.id, w.name]));
    const uName = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({
      ...r,
      fromWarehouseName: r.fromWarehouseId ? wName.get(r.fromWarehouseId) ?? null : null,
      toWarehouseName: r.toWarehouseId ? wName.get(r.toWarehouseId) ?? null : null,
      actorName: r.actorId ? uName.get(r.actorId) ?? null : null,
    }));
  },
};