import { prisma } from "@/lib/prisma";
import { LogisticsScopeService } from "@/services/logistics-scope.service";
import { resolveActorWarehouseId } from "@/lib/actor-warehouse";
import { LogisticsError } from "@/lib/logistics-errors";

export const ActorWarehouse = {
  /** مستودع المستخدم الفاعل (يُستعمل عند إنشاء سجلات الكاش والتسليم). */
  async forUser(userId: number, requested?: number): Promise<number> {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!u) throw new LogisticsError("المستخدم غير موجود", 403);
    const scope = await LogisticsScopeService.forUser(userId, u.role);
    return resolveActorWarehouseId(scope, requested);
  },
};