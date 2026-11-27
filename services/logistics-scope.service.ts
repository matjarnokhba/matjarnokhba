import { prisma } from "@/lib/prisma";
import { resolveScope, type ResolvedScope } from "@/lib/logistics-scope";

export const LogisticsScopeService = {
  async forUser(userId: number, role: string): Promise<ResolvedScope> {
    const [memberships, warehouses] = await Promise.all([
      prisma.logisticsMembership.findMany({
        where: { userId },
        select: {
          scope: true,
          companyId: true,
          warehouseId: true,
          jobRoles: true,
          status: true,
        },
      }),
      prisma.warehouse.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, companyId: true },
      }),
    ]);
    return resolveScope({ role, memberships, warehouses });
  },
};