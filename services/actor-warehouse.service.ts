import { prisma } from "@/lib/prisma";
import { LogisticsScopeService } from "@/services/logistics-scope.service";
import { resolveActorWarehouseId } from "@/lib/actor-warehouse";

export const ActorWarehouse = {
  /** مستودع المستخدم الفاعل (يُستعمل عند إنشاء سجلات الكاش والتسليم). */
  async forUser(userId: number, requested?: number): Promise<number> {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!u) return 1;
    const scope = await LogisticsScopeService.forUser(userId, u.role);
    return resolveActorWarehouseId(scope, requested);
  },
};