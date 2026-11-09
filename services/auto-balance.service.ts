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
  sizeValue: string | null;
  stock: number;
  weight: number;
  isRare: boolean;
  isBlocked: boolean;
  rawQuantity: number;
  suggestedQty: number;
  maxAllowed: number;
};

export type ComputeResult = {
  totalQty: number;
  totalDistributed: number;
  minDistributed: number;
  maxStock: number;
  availableSizes: string[];
  sizeFilterApplied: string[] | null;
  requireSizeSelection: boolean;
  variants: VariantDistribution[];
  config: AutoBalanceConfig;
};

function getSizeValue(attrs: any): string | null {
  if (!Array.isArray(attrs)) return null;
  for (const a of attrs) {
    if (!a || typeof a.name !== "string") continue;
    const name = a.name.toLowerCase().trim();
    if (name.includes("مقاس") || name.includes("size")) {
      const v = String(a.value ?? "").trim();
      return v || null;
    }
  }
  return null;
}
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
  async compute(
    offerId: number,
    totalQty: number,
    locked?: { variantId: number; qty: number },
    sizeFilter?: string[]
  ): Promise<ComputeResult> {
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

    // Compute weights + size values
    const variantData = offer.variants.map((v) => {
      const attrs = (v.masterVariant?.attributes as Array<{ name: string; value: string }>) ?? [];
      return {
        variantId: v.id,
        merchantVariantId: v.merchantVariantId,
        attributes: attrs,
        sizeValue: getSizeValue(attrs),
        stock: v.merchantVariantId ? stockMap.get(v.merchantVariantId) || 0 : 0,
      };
    });

    const maxStock = Math.max(0, ...variantData.map((v) => v.stock));

    // Size filter
    const availableSizesSet = new Set<string>();
    for (const v of variantData) {
      if (v.sizeValue) availableSizesSet.add(v.sizeValue);
    }
    const availableSizes = Array.from(availableSizesSet).sort();

    const hasSizeFilter = Array.isArray(sizeFilter) && sizeFilter.length > 0;
    // Only require size selection when the offer actually has size attributes
    if (offer.requireSizeSelection && availableSizes.length > 0 && !hasSizeFilter) {
      throw new Error("يجب اختيار مقاس واحد على الأقل قبل التوزيع");
    }

    const isInFilter = (sv: string | null): boolean => {
      if (!hasSizeFilter) return true;
      return sv !== null && sizeFilter!.includes(sv);
    };

    // Compute weight + rare + blocked
    const withWeights = variantData.map((v) => ({
      ...v,
      weight: maxStock > 0 ? v.stock / maxStock : 0,
      isRare: maxStock > 0 ? v.stock / maxStock < config.rareThreshold : false,
      isBlocked: !isInFilter(v.sizeValue),
    }));

    // Only non-rare, non-blocked variants participate in auto-distribution
    const distributableAll = withWeights.filter((v) => !v.isRare && !v.isBlocked && v.stock > 0);
    const distributable = locked
      ? distributableAll.filter((v) => v.variantId !== locked.variantId)
      : distributableAll;
    const sumWeight = distributable.reduce((s, v) => s + v.weight, 0);

    if (sumWeight === 0) {
      return {
        totalQty,
        totalDistributed: 0,
        minDistributed: 0,
        maxStock,
        availableSizes,
        sizeFilterApplied: hasSizeFilter ? sizeFilter! : null,
        requireSizeSelection: offer.requireSizeSelection,
        config,
        variants: withWeights.map((v) => ({
          variantId: v.variantId,
          merchantVariantId: v.merchantVariantId,
          attributes: v.attributes,
          sizeValue: v.sizeValue,
          stock: v.stock,
          weight: v.weight,
          isRare: v.isRare,
          isBlocked: v.isBlocked,
          rawQuantity: 0,
          suggestedQty: 0,
          maxAllowed: 0,
        })),
      };
    }

    // Adjust total for distribution: subtract locked quantity
    const lockedQty = locked?.qty ?? 0;
    const distributableTotal = Math.max(0, totalQty - lockedQty);

    // Raw and rounded
    const rawMap = new Map<number, number>();
    const roundedMap = new Map<number, number>();
    for (const v of distributable) {
      const raw = sumWeight > 0 ? (distributableTotal * v.weight) / sumWeight : 0;
      rawMap.set(v.variantId, raw);
      roundedMap.set(v.variantId, roundWithThreshold(raw, config.roundThreshold));
    }

    // Set locked variant to its locked quantity
    if (locked) {
      rawMap.set(locked.variantId, locked.qty);
      roundedMap.set(locked.variantId, locked.qty);
    }

    // Fix total after rounding (locked variant NOT touched)
    let sumRounded = 0;
    for (const q of roundedMap.values()) sumRounded += q;
    let delta = totalQty - sumRounded;

    if (delta !== 0 && distributable.length > 0) {
      // Add/subtract from the variant with the largest stock among distributable (non-rare, non-locked)
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

    // minDistributed = min of non-rare, non-blocked quantities
    const nonRareQtys: number[] = [];
    for (const v of distributableAll) {
      const q = roundedMap.get(v.variantId) ?? 0;
      if (q > 0) nonRareQtys.push(q);
    }
    const minDistributed = nonRareQtys.length > 0 ? Math.min(...nonRareQtys) : 0;

    // Build result
    let totalDistributed = 0;
    const variantsResult: VariantDistribution[] = withWeights.map((v) => {
      const raw = rawMap.get(v.variantId) ?? 0;
      let suggested = roundedMap.get(v.variantId) ?? 0;
      if (v.isBlocked) suggested = 0;
      totalDistributed += suggested;

      let maxAllowed: number;
      if (v.isBlocked) maxAllowed = 0;
      else if (v.isRare) maxAllowed = minDistributed;
      else maxAllowed = v.stock;

      return {
        variantId: v.variantId,
        merchantVariantId: v.merchantVariantId,
        attributes: v.attributes,
        sizeValue: v.sizeValue,
        stock: v.stock,
        weight: v.weight,
        isRare: v.isRare,
        isBlocked: v.isBlocked,
        rawQuantity: Math.round(raw * 100) / 100,
        suggestedQty: suggested,
        maxAllowed,
      };
    });

    return {
      totalQty,
      totalDistributed,
      minDistributed,
      maxStock,
      availableSizes,
      sizeFilterApplied: hasSizeFilter ? sizeFilter! : null,
      requireSizeSelection: offer.requireSizeSelection,
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