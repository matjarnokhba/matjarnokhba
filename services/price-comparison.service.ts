import { prisma } from "@/lib/prisma";
import { WHOLESALE_CONFIG } from "@/lib/wholesale/config";

type TierRow = {
  minQty: number;
  maxQty: number | null;
  unitPrice: number;
  offerId: number;
  offerVariantId: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const PriceComparisonService = {
  async refreshForVariant(tx: any, masterVariantId: number): Promise<number> {
    const db = tx ?? prisma;

    const offerVariants = await db.wholesaleOfferVariant.findMany({
      where: {
        masterVariantId,
        offer: {
          status: "ACTIVE",
          deletedAt: null,
          businessUnit: { status: "ACTIVE", deletedAt: null },
          master: { status: "ACTIVE", deletedAt: null },
        },
      },
      include: {
        offer: { select: { id: true, isActive: true } },
        tiers: { orderBy: { minQty: "asc" } },
      },
    });

    const tiersByMin = new Map<number, TierRow[]>();

    for (const ov of offerVariants) {
      if (!ov.offer.isActive) continue;
      for (const t of ov.tiers) {
        const minQty = Number(t.minQty);
        if (!tiersByMin.has(minQty)) tiersByMin.set(minQty, []);
        tiersByMin.get(minQty)!.push({
          minQty,
          maxQty: t.maxQty === null ? null : Number(t.maxQty),
          unitPrice: Number(t.unitPrice),
          offerId: ov.offer.id,
          offerVariantId: ov.id,
        });
      }
    }

    const thresholdPercent = WHOLESALE_CONFIG.PRICE_ALERT_THRESHOLD_PERCENT;
    let written = 0;

    for (const [minQty, rows] of tiersByMin) {
      const eligible = rows.filter((r) => r.unitPrice > 0);
      if (eligible.length < 1) continue;

      eligible.sort((a, b) => a.unitPrice - b.unitPrice);
      const lowest = eligible[0];
      const eligibleOffersCount = eligible.length;
      const threshold5 = round2(lowest.unitPrice * (1 + thresholdPercent / 100));
      const threshold10 = round2(lowest.unitPrice * 1.1);
      const maxQty = rows[0].maxQty ?? null;
      const sellingUnitId = 0;

      await db.priceComparisonCache.upsert({
        where: {
          masterVariantId_sellingUnitId_tierMinQty: {
            masterVariantId,
            sellingUnitId,
            tierMinQty: minQty,
          },
        },
        create: {
          masterVariantId,
          sellingUnitId,
          tierMinQty: minQty,
          tierMaxQty: maxQty,
          lowestPrice: lowest.unitPrice,
          lowestPriceOfferId: lowest.offerId,
          eligibleOffersCount,
          threshold5Percent: threshold5,
          threshold10Percent: threshold10,
          calculatedAt: new Date(),
        },
        update: {
          tierMaxQty: maxQty,
          lowestPrice: lowest.unitPrice,
          lowestPriceOfferId: lowest.offerId,
          eligibleOffersCount,
          threshold5Percent: threshold5,
          threshold10Percent: threshold10,
          calculatedAt: new Date(),
        },
      });
      written++;
    }

    return written;
  },

  async refreshAll(tx?: any): Promise<{ variants: number; rows: number }> {
    const db = tx ?? prisma;
    const variants = await db.wholesaleOfferVariant.findMany({
      where: {
        offer: {
          status: "ACTIVE",
          deletedAt: null,
          businessUnit: { status: "ACTIVE", deletedAt: null },
        },
      },
      select: { masterVariantId: true },
      distinct: ["masterVariantId"],
    });

    let rows = 0;
    for (const v of variants) {
      rows += await this.refreshForVariant(tx, v.masterVariantId);
    }
    return { variants: variants.length, rows };
  },

  async getLowestForQuantity(masterVariantId: number, quantity: number) {
    const cache = await prisma.priceComparisonCache.findMany({
      where: {
        masterVariantId,
        tierMinQty: { lte: quantity },
      },
      orderBy: { tierMinQty: "desc" },
      take: 1,
    });
    if (cache.length === 0) return null;
    const c = cache[0];
    if (c.tierMaxQty !== null && quantity > Number(c.tierMaxQty)) return null;

    return {
      lowestPrice: Number(c.lowestPrice),
      lowestPriceOfferId: c.lowestPriceOfferId,
      eligibleOffersCount: c.eligibleOffersCount,
      threshold5Percent: Number(c.threshold5Percent),
      threshold10Percent: Number(c.threshold10Percent),
      tierMinQty: Number(c.tierMinQty),
      tierMaxQty: c.tierMaxQty === null ? null : Number(c.tierMaxQty),
      calculatedAt: c.calculatedAt,
    };
  },

  async getAlertForOffer(offerId: number, masterVariantId: number) {
    const ov = await prisma.wholesaleOfferVariant.findFirst({
      where: { offerId, masterVariantId },
      include: { tiers: { orderBy: { minQty: "asc" } } },
    });
    if (!ov || ov.tiers.length === 0) return null;

    const alerts: Array<{
      minQty: number;
      maxQty: number | null;
      unitPrice: number;
      lowestPrice: number;
      isAbove5: boolean;
      isAbove10: boolean;
      percentAboveLowest: number;
    }> = [];

    for (const t of ov.tiers) {
      const cache = await prisma.priceComparisonCache.findFirst({
        where: { masterVariantId, tierMinQty: t.minQty },
      });
      if (!cache) continue;
      if (cache.eligibleOffersCount < WHOLESALE_CONFIG.PRICE_CACHE_MIN_OFFERS) continue;

      const price = Number(t.unitPrice);
      const lowest = Number(cache.lowestPrice);
      if (lowest <= 0) continue;

      const percentAbove = round2(((price - lowest) / lowest) * 100);
      const isAbove5 = price > Number(cache.threshold5Percent);
      const isAbove10 = price > Number(cache.threshold10Percent);

      if (isAbove5) {
        alerts.push({
          minQty: Number(t.minQty),
          maxQty: t.maxQty === null ? null : Number(t.maxQty),
          unitPrice: price,
          lowestPrice: lowest,
          isAbove5,
          isAbove10,
          percentAboveLowest: percentAbove,
        });
      }
    }

    return alerts.length > 0
      ? {
          offerId,
          masterVariantId,
          alerts,
          calculatedAt: new Date(),
        }
      : null;
  },

  async getAlertsForVariant(masterVariantId: number) {
    const offers = await prisma.wholesaleOfferVariant.findMany({
      where: {
        masterVariantId,
        offer: { status: "ACTIVE", deletedAt: null },
      },
      select: { offerId: true },
      distinct: ["offerId"],
    });

    const alerts = [];
    for (const o of offers) {
      const alert = await this.getAlertForOffer(o.offerId, masterVariantId);
      if (alert) alerts.push(alert);
    }
    return alerts;
  },

  async purgeStale(minutesOld = WHOLESALE_CONFIG.PRICE_CACHE_TTL_MINUTES * 2) {
    const cutoff = new Date(Date.now() - minutesOld * 60 * 1000);
    const deleted = await prisma.priceComparisonCache.deleteMany({
      where: { calculatedAt: { lt: cutoff } },
    });
    return { purged: deleted.count };
  },
};