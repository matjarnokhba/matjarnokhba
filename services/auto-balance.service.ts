import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/wholesale/errors";

export type AutoBalanceConfig = {
  rareThreshold: number;   // default 0.25
  roundThreshold: number;  // default 0.7
};

const DEFAULT_CONFIG: AutoBalanceConfig = {
  rareThreshold: 0.25,
  roundThreshold: 0.7,
};

export type VariantDistribution = {
  variantId: number;
  merchantVariantId: number | null;
  attributes: Array<{ name: string; value: string }>;
  stock: number;
  weight: number;
  isRare: boolean;
  rawQuantity: number;
  suggestedQty: number;
  maxAllowed: number; // for rare: min(other rounded); for non-rare: stock
};

export type ComputeResult = {
  totalQty: number;
  totalDistributed: number;
  minDistributed: number;
  maxStock: number;
  variants: VariantDistribution[];
  config: AutoBalanceConfig;
};

function roundWithThreshold(value: number, threshold: number): number {
  if (value < 0.0001) return 0;
  const floor = Math.floor(value);
  const frac = value - floor;
  return frac >= threshold ? floor + 1 : floor;
}

export const AutoBalanceService = {
  /**
   * Compute distribution for a given totalQty.
   * Only uses non-rare variants for auto-distribution.
   * Rare variants are excluded (suggestedQty = 0).
   */
  async compute(offerId: number, totalQty: number): Promise<ComputeResult> {
    if (!Number.isInteger(totalQty) || totalQty < 1) {
      throw new Error("totalQty يجب أن يكون عدداً صحيحاً موجباً");
    }

    const offer = await prisma.wholesaleOffer.findUnique({
      where: { id: offerId },
      include: {
        variants: {
          include: {
            masterVariant: { select: { attributes: true } },
          },
        },
      },
    });
    if (!offer) throw new NotFoundError("WholesaleOffer", offerId);

    const config: AutoBalanceConfig = {
      ...DEFAULT_CONFIG,
      ...((offer.autoBalanceConfig as any) || {}),
    };

    // Fetch stock per variant
    const merchantVariantIds = offer.variants
      .map((v) => v.merchantVariantId)
      .filter((id): id is number => typeof id === "number");

    const stockMap = new Map<number, number>();
    if (merchantVariantIds.length > 0) {
      const [balances, reservations] = await Promise.all([
        prisma.inventoryBalance.findMany({
          where: { merchantVariantId: { in: merchantVariantIds } },
          select: { merchantVariantId: true, quantity: true },
        }),
        prisma.stockReservation.findMany({
          where: { merchantVariantId: { in: merchantVariantIds }, status: "ACTIVE" },
          select: { merchantVariantId: true, quantity: true },
        }),
      ]);
      for (const b of balances) {
        stockMap.set(
          b.merchantVariantId,
          (stockMap.get(b.merchantVariantId) || 0) + b.quantity
        );
      }
      for (const r of reservations) {
        stockMap.set(
          r.merchantVariantId,
          Math.max(0, (stockMap.get(r.merchantVariantId) || 0) - r.quantity)
        );
      }
    }

    // Compute weights
    const variantData = offer.variants.map((v) => ({
      variantId: v.id,
      merchantVariantId: v.merchantVariantId,
      attributes: (v.masterVariant?.attributes as Array<{ name: string; value: string }>) ?? [],
      stock: v.merchantVariantId ? stockMap.get(v.merchantVariantId) || 0 : 0,
    }));

    const maxStock = Math.max(0, ...variantData.map((v) => v.stock));

    // Compute weight and rare flag
    const withWeights = variantData.map((v) => ({
      ...v,
      weight: maxStock > 0 ? v.stock / maxStock : 0,
      isRare: maxStock > 0 ? v.stock / maxStock < config.rareThreshold : false,
    }));

    // Only non-rare variants participate in auto-distribution
    const distributable = withWeights.filter((v) => !v.isRare && v.stock > 0);
    const sumWeight = distributable.reduce((s, v) => s + v.weight, 0);

    if (sumWeight === 0) {
      return {
        totalQty,
        totalDistributed: 0,
        minDistributed: 0,
        maxStock,
        config,
        variants: withWeights.map((v) => ({
          variantId: v.variantId,
          merchantVariantId: v.merchantVariantId,
          attributes: v.attributes,
          stock: v.stock,
          weight: v.weight,
          isRare: v.isRare,
          rawQuantity: 0,
          suggestedQty: 0,
          maxAllowed: 0,
        })),
      };
    }

    // Raw and rounded
    const rawMap = new Map<number, number>();
    const roundedMap = new Map<number, number>();
    for (const v of distributable) {
      const raw = (totalQty * v.weight) / sumWeight;
      rawMap.set(v.variantId, raw);
      roundedMap.set(v.variantId, roundWithThreshold(raw, config.roundThreshold));
    }

    // Fix total after rounding
    let sumRounded = 0;
    for (const q of roundedMap.values()) sumRounded += q;
    let delta = totalQty - sumRounded;

    if (delta !== 0) {
      // Add/subtract from the variant with the largest stock (non-rare)
      const largest = distributable.reduce(
        (best, v) => (v.stock > best.stock ? v : best),
        distributable[0]
      );
      roundedMap.set(
        largest.variantId,
        Math.max(0, (roundedMap.get(largest.variantId) || 0) + delta)
      );
    }

    // Cap by stock
    for (const v of distributable) {
      const q = roundedMap.get(v.variantId) || 0;
      roundedMap.set(v.variantId, Math.min(q, v.stock));
    }

    // minDistributed = min of non-rare rounded (for rare cap)
    const nonRareQty = distributable.map((v) => roundedMap.get(v.variantId) || 0);
    const minDistributed = nonRareQty.length > 0 ? Math.min(...nonRareQty) : 0;

    // Build result
    let totalDistributed = 0;
    const variantsResult: VariantDistribution[] = withWeights.map((v) => {
      const raw = rawMap.get(v.variantId) ?? 0;
      const suggested = roundedMap.get(v.variantId) ?? 0;
      totalDistributed += suggested;
      return {
        variantId: v.variantId,
        merchantVariantId: v.merchantVariantId,
        attributes: v.attributes,
        stock: v.stock,
        weight: v.weight,
        isRare: v.isRare,
        rawQuantity: Math.round(raw * 100) / 100,
        suggestedQty: suggested,
        maxAllowed: v.isRare ? minDistributed : v.stock,
      };
    });

    return {
      totalQty,
      totalDistributed,
      minDistributed,
      maxStock,
      variants: variantsResult,
      config,
    };
  },

  /**
   * Recompute (update timestamp only). Weights are computed on-demand.
   */
  async recompute(offerId: number): Promise<void> {
    await prisma.wholesaleOffer.update({
      where: { id: offerId },
      data: { autoBalanceUpdatedAt: new Date() },
    });
  },
};