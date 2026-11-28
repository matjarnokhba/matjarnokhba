/* eslint-disable @typescript-eslint/no-explicit-any */
const j = (v: unknown) => (v === undefined || v === null ? undefined : JSON.parse(JSON.stringify(v)));

export const LOGISTICS_AUDIT_ENTITIES = ["Warehouse", "LogisticsCompany", "LogisticsMembership", "WarehouseTransfer", "ClientPlatform", "CompanyPlatformLink", "DeliveryPerson", "ShippingProvider", "ExternalShipment", "ExternalCourierSettlement", "PlatformRoutingConfig", "CompanyCityCoverage"] as const;

/** سجل تدقيق لوجستي (إضافة فقط — لا تعديل ولا حذف من التطبيق). يعمل داخل المعاملة نفسها. */
export async function logLogisticsAudit(
  tx: any,
  e: {
    userId: number | null;
    action: string;
    entityType: (typeof LOGISTICS_AUDIT_ENTITIES)[number];
    entityId: number;
    before?: unknown;
    after?: unknown;
    metadata?: unknown;
  }
): Promise<void> {
  await tx.operationAuditLog.create({
    data: {
      userId: e.userId,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      before: j(e.before),
      after: j(e.after),
      metadata: j(e.metadata),
    },
  });
}