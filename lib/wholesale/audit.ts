import { prisma } from "@/lib/prisma";

export async function logWholesaleAction(
  tx: any,
  params: {
    userId: number | null;
    businessUnitId?: number | null;
    action: string;
    entityType: string;
    entityId: number;
    before?: any;
    after?: any;
    metadata?: any;
  }
): Promise<void> {
  try {
    const db = tx ?? prisma;
    await db.operationAuditLog.create({
      data: {
        userId: params.userId ?? null,
        businessUnitId: params.businessUnitId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        before: params.before ?? null,
        after: params.after ?? null,
        metadata: params.metadata ?? null,
      },
    });
  } catch (err) {
    console.error("Wholesale audit log failed:", err);
  }
}