import { IdentityService } from "@/services/identity.service";
import { CARD_EVERY, SUCCESS_AFTER_DAYS, pickCardOrders } from "@/lib/free-return-card";

const DAY = 24 * 60 * 60 * 1000;

export const FreeReturnCardService = {
  // يحتسب البطاقات لكل الهويات (مهمة يومية)
  async accrueAll(db: any, now: Date = new Date()) {
    const cutoff = new Date(now.getTime() - SUCCESS_AFTER_DAYS * DAY);

    // 1) حسابات لها طلبيات ناجحة ولا هوية لها بعد: اربطها
    const orphans = await db.user.findMany({
      where: {
        identityId: null,
        deletedAt: null,
        orders: {
          some: { status: "DELIVERED", source: "ONLINE", deliveredAt: { lte: cutoff }, countedForCardId: null },
        },
      },
      select: { id: true },
      take: 500,
    });
    let attached = 0;
    for (const o of orphans) {
      try {
        if (await IdentityService.attachUser(db, o.id)) attached++;
      } catch (e) {
        console.error("accrue: attach failed", o.id, e);
      }
    }

    // 2) الطلبيات الناجحة غير المحتسبة
    const rows = await db.order.findMany({
      where: {
        status: "DELIVERED",
        source: "ONLINE",
        paymentStatus: "PAID",
        deliveredAt: { lte: cutoff },
        countedForCardId: null,
        returnRequests: { none: { status: { in: ["PENDING", "APPROVED", "COMPLETED"] } } },
        user: { identityId: { not: null } },
      },
      select: { id: true, deliveredAt: true, user: { select: { identityId: true } } },
      orderBy: { deliveredAt: "asc" },
      take: 5000,
    });

    const byIdentity = new Map<number, { id: number; deliveredAt: Date }[]>();
    for (const r of rows) {
      const iid = r.user?.identityId;
      if (!iid || !r.deliveredAt) continue;
      const list = byIdentity.get(iid) ?? [];
      list.push({ id: r.id, deliveredAt: r.deliveredAt });
      byIdentity.set(iid, list);
    }

    let created = 0;
    for (const [identityId, orders] of byIdentity) {
      if (orders.length < CARD_EVERY) continue;
      const open = await db.freeReturnCard.findFirst({ where: { identityId, usedAt: null }, select: { id: true } });
      if (open) continue;
      const agg = await db.freeReturnCard.aggregate({
        where: { identityId, usedAt: { not: null } },
        _max: { usedAt: true },
      });
      const ids = pickCardOrders(orders, agg?._max?.usedAt ?? null);
      if (!ids) continue;
      try {
        await db.$transaction(async (tx: any) => {
          const card = await tx.freeReturnCard.create({ data: { identityId }, select: { id: true } });
          const upd = await tx.order.updateMany({
            where: { id: { in: ids }, countedForCardId: null },
            data: { countedForCardId: card.id },
          });
          if (upd.count !== ids.length) throw new Error("orders already counted");
        });
        created++;
      } catch (e) {
        console.error("accrue: card creation failed", identityId, e);
      }
    }
    return { scanned: rows.length, attached, created };
  },

  async hasOpenCard(db: any, identityId: number): Promise<boolean> {
    const c = await db.freeReturnCard.findFirst({ where: { identityId, usedAt: null }, select: { id: true } });
    return !!c;
  },
};