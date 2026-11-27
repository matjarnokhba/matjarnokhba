import { prisma } from "@/lib/prisma";
import type { ResolvedScope } from "@/lib/logistics-scope";

/**
 * شرط Prisma يحصر السائقين في شركات نطاق المستخدم.
 * شركات النطاق = شركات العضويات + شركات المستودعات التي يملك صلاحيتها (المدير القديم بلا عضوية له مستودع افتراضي فقط).
 * الأدمن بلا قيود.
 */
export async function driverWhere(scope: ResolvedScope): Promise<Record<string, unknown>> {
  if (scope.platform) return {};
  const ws = scope.warehouseIds.length
    ? await prisma.warehouse.findMany({ where: { id: { in: scope.warehouseIds } }, select: { companyId: true } })
    : [];
  const ids = Array.from(new Set<number>([...scope.companyIds, ...ws.map((w) => w.companyId)]));
  return { companyId: { in: ids } };
}