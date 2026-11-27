/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { resolveShipmentWarehouseId } from "@/lib/warehouse-resolve";
import type { SettlementCreateInput } from "@/lib/external-settlement-validation";
import { LogisticsError } from "@/lib/logistics-errors";
import { logLogisticsAudit } from "@/lib/logistics-audit";
import type { Actor } from "@/services/logistics-admin.service";

type Opts = { tx?: any };

function run<T>(opts: Opts | undefined, fn: (tx: any) => Promise<T>): Promise<T> {
  if (opts?.tx) return fn(opts.tx);
  return (prisma as any).$transaction(fn, { timeout: 30000, maxWait: 10000 });
}

const money = (n: unknown) => Math.round(Number(n ?? 0) * 100) / 100;

function needPlatform(actor: Actor) {
  if (!actor.scope.platform) throw new LogisticsError("هذه العملية للأدمن فقط", 403);
}

export const ExternalSettlementService = {
  /** الديون المفتوحة على شركة (COD لم تُسوَّ بعد). */
  async openReceivables(actor: Actor, providerId: number, opts?: Opts) {
    needPlatform(actor);
    const db = (opts?.tx ?? prisma) as any;
    const rows = await db.externalCodReceivable.findMany({
      where: { providerId, status: "OPEN" },
      orderBy: { id: "asc" },
      take: 500,
      select: { id: true, shipmentId: true, amountDue: true, shippingCharged: true, createdAt: true },
    });
    const ships = await db.shipment.findMany({ where: { id: { in: rows.map((r: any) => r.shipmentId) } }, select: { id: true, shipmentNumber: true } });
    const num = new Map<number, string>(ships.map((s: any) => [s.id, s.shipmentNumber]));
    return rows.map((r: any) => ({
      id: r.id,
      shipmentId: r.shipmentId,
      shipmentNumber: num.get(r.shipmentId) ?? String(r.shipmentId),
      amountDue: money(r.amountDue),
      shippingCharged: money(r.shippingCharged),
      createdAt: r.createdAt,
    }));
  },

  async list(actor: Actor, providerId?: number, opts?: Opts) {
    needPlatform(actor);
    const db = (opts?.tx ?? prisma) as any;
    const rows = await db.externalCourierSettlement.findMany({
      where: providerId ? { providerId } : {},
      orderBy: { id: "desc" },
      take: 100,
    });
    return rows.map((r: any) => ({
      id: r.id,
      providerId: r.providerId,
      reference: r.reference,
      linesCount: r.linesCount,
      totalDue: money(r.totalDue),
      totalFees: money(r.totalFees),
      expectedNet: money(r.expectedNet),
      received: money(r.received),
      shortfall: money(r.shortfall),
      feeOverShipping: money(r.feeOverShipping),
      notes: r.notes,
      createdAt: r.createdAt,
    }));
  },

  /**
   * تسوية مع الشركة: تُسدَّد الديون المختارة برسم الشركة لكل شحنة (من كشفها) وصافي المبلغ المستلم.
   * ربح المستودع = رسم الشحن - رسم الشركة (لا يقل عن صفر كالمسار الداخلي). النقص عن المستحق يُسجَّل ولا يُخفى.
   */
  async create(actor: Actor, input: SettlementCreateInput, opts?: Opts) {
    needPlatform(actor);
    const ids = input.lines.map((l) => l.receivableId);
    if (new Set(ids).size !== ids.length) throw new LogisticsError("سطر مكرر في التسوية", 400);
    return run(opts, async (tx) => {
      const provider = await tx.shippingProvider.findUnique({ where: { id: input.providerId }, select: { id: true, name: true } });
      if (!provider) throw new LogisticsError("شركة التوصيل غير موجودة", 404);
      const reference = input.reference?.trim() || null;
      if (reference) {
        const dup = await tx.externalCourierSettlement.findFirst({ where: { providerId: input.providerId, reference }, select: { id: true } });
        if (dup) throw new LogisticsError("مرجع التسوية مستعمل سابقاً لهذه الشركة", 409);
      }
      const recs = await tx.externalCodReceivable.findMany({
        where: { id: { in: ids }, providerId: input.providerId, status: "OPEN" },
        select: { id: true, shipmentId: true, warehouseId: true, amountDue: true, shippingCharged: true },
      });
      if (recs.length !== ids.length) throw new LogisticsError("بعض الديون غير موجودة أو سُوّيت سابقاً أو تخص شركة أخرى", 409);
      const byId = new Map<number, any>(recs.map((r: any) => [r.id, r]));

      let totalDue = 0;
      let totalFees = 0;
      let feeOver = 0;
      const calc: { rec: any; fee: number; profit: number }[] = [];
      for (const l of input.lines) {
        const rec = byId.get(l.receivableId);
        const fee = money(l.courierFee);
        const due = money(rec.amountDue);
        if (fee > due) throw new LogisticsError("رسم الشركة يتجاوز المبلغ المحصّل (دَين #" + rec.id + ")", 400);
        const ship = money(rec.shippingCharged);
        const profit = Math.max(0, money(ship - fee));
        feeOver += Math.max(0, money(fee - ship));
        totalDue += due;
        totalFees += fee;
        calc.push({ rec, fee, profit });
      }
      totalDue = money(totalDue);
      totalFees = money(totalFees);
      feeOver = money(feeOver);
      const expectedNet = money(totalDue - totalFees);
      const received = money(input.received);
      const shortfall = money(expectedNet - received);

      const settlement = await tx.externalCourierSettlement.create({
        data: {
          providerId: input.providerId,
          reference,
          totalDue,
          totalFees,
          expectedNet,
          received,
          shortfall,
          feeOverShipping: feeOver,
          linesCount: calc.length,
          notes: input.notes?.trim() || null,
          createdById: actor.id,
        },
        select: { id: true },
      });

      const ships = await tx.shipment.findMany({ where: { id: { in: calc.map((c) => c.rec.shipmentId) } }, select: { id: true, shipmentNumber: true } });
      const num = new Map<number, string>(ships.map((s: any) => [s.id, s.shipmentNumber]));
      const now = new Date();
      let profitTotal = 0;
      for (const c of calc) {
        const u = await tx.externalCodReceivable.updateMany({
          where: { id: c.rec.id, status: "OPEN" },
          data: { status: "SETTLED", courierFee: c.fee, settlementId: settlement.id, settledAt: now },
        });
        if (u.count !== 1) throw new LogisticsError("تغيّرت حالة دَين أثناء التسوية، أعد المحاولة", 409);
        if (c.profit > 0) {
          const whId = c.rec.warehouseId ?? (await resolveShipmentWarehouseId(tx, c.rec.shipmentId));
          const w = await tx.wallet.upsert({
            where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: whId } },
            create: { ownerType: "WAREHOUSE", ownerId: whId, balance: c.profit },
            update: { balance: { increment: c.profit } },
          });
          await tx.walletTransactionUnified.create({
            data: {
              walletId: w.id,
              amount: c.profit,
              type: "SHIPPING_PROFIT",
              description: "ربح شحن (شركة خارجية) شحنة #" + (num.get(c.rec.shipmentId) ?? c.rec.shipmentId) + " — تسوية #" + settlement.id,
              referenceId: "ext-settle:" + settlement.id + ":" + c.rec.id,
            },
          });
          profitTotal += c.profit;
        }
      }
      profitTotal = money(profitTotal);
      await logLogisticsAudit(tx, {
        userId: actor.id,
        action: "LOGISTICS_EXTERNAL_SETTLEMENT",
        entityType: "ExternalCourierSettlement",
        entityId: settlement.id,
        after: { providerId: input.providerId, reference, lines: calc.length, totalDue, totalFees, expectedNet, received, shortfall, feeOver, profitTotal },
      });
      return { id: settlement.id, totalDue, totalFees, expectedNet, received, shortfall, feeOverShipping: feeOver, warehouseProfit: profitTotal, linesCount: calc.length };
    });
  },
};