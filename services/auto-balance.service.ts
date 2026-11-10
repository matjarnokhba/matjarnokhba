import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/wholesale/errors";

export type AutoBalanceConfig = {
  rareThreshold: number;
  roundThreshold: number;
};

const DEFAULT_CONFIG: AutoBalanceConfig = {
  rareThreshold: 0.25,
  roundThreshold: 0.7,
};

export type SizeQty = { size: string; qty: number };

export type VariantDistribution = {
  variantId: number;
  merchantVariantId: number | null;
  attributes: Array<{ name: string; value: string }>;
  sizeValue: string | null;
  stock: number;
  weight: number;
  isRare: boolean;
  isBlocked: boolean;
  baseQty: number;
  suggestedQty: number;
  minAllowed: number;
  maxAllowed: number;
  maxAdjust: number;
  rawQuantity: number;
};

export type ComputeResult = {
  totalQty: number;
  totalDistributed: number;
  minDistributed: number;
  maxStock: number;
  availableSizes: string[];
  sizeFilterApplied: string[] | null;
  requireSizeSelection: boolean;
  maxManualAdjustment: number;
  sizeLimits: Record<string, number>;
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
   * Compute distribution.
   *
   * Accepts:
   *  - sizesInput as number → legacy wildcard (distribute N across all variants)
   *  - sizesInput as SizeQty[] → per-size distribution (each size gets its own qty)
   */
  async compute(
    offerId: number,
    sizesInput: SizeQty[] | number
  ): Promise<ComputeResult> {
    // Normalize input
    let sizes: SizeQty[];
    if (typeof sizesInput === "number") {
      if (!Number.isInteger(sizesInput) || sizesInput < 1) {
        throw new Error("totalQty يجب أن يكون عدداً صحيحاً موجباً");
      }
      sizes = [{ size: "*", qty: sizesInput }];
    } else {
      sizes = sizesInput.filter((s) => s.qty > 0);
      if (sizes.length === 0) {
        throw new Error("مطلوب كمية واحدة على الأقل");
      }
      for (const s of sizes) {
        if (!Number.isInteger(s.qty) || s.qty < 1) {
          throw new Error(`كمية غير صحيحة للمقاس ${s.size}`);
        }
      }
    }

    const offer = await prisma.wholesaleOffer.findUnique({
      where: { id: offerId },
      include: {
        variants: {
          include: { masterVariant: { select: { attributes: true } } },
        },
      },
    });
    if (!offer) throw new NotFoundError("WholesaleOffer", offerId);

    const config: AutoBalanceConfig = {
      ...DEFAULT_CONFIG,
      ...((offer.autoBalanceConfig as any) || {}),
    };
    const maxAdjust = Math.max(0, offer.maxManualAdjustment ?? 1);

    // M10.9b: load per-size minimum order limits
    const sizeLimitsRows = await prisma.wholesaleOfferSizeLimit.findMany({
      where: { offerId },
      select: { size: true, minOrderQty: true },
    });
    const sizeLimits: Record<string, number> = {};
    for (const row of sizeLimitsRows) {
      sizeLimits[row.size] = row.minOrderQty;
    }

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

    // Build variant data
    const variantData = offer.variants.map((v) => {
      const attrs =
        (v.masterVariant?.attributes as Array<{ name: string; value: string }>) ?? [];
      return {
        variantId: v.id,
        merchantVariantId: v.merchantVariantId,
        attributes: attrs,
        sizeValue: getSizeValue(attrs),
        stock: v.merchantVariantId ? stockMap.get(v.merchantVariantId) || 0 : 0,
      };
    });

    // Available sizes
    const availableSizesSet = new Set<string>();
    for (const v of variantData) {
      if (v.sizeValue) availableSizesSet.add(v.sizeValue);
    }
    const availableSizes = Array.from(availableSizesSet).sort();

    const isWildcard = sizes.length === 1 && sizes[0].size === "*";

    // Validate requireSizeSelection
    if (offer.requireSizeSelection && availableSizes.length > 0) {
      if (isWildcard) {
        throw new Error("يجب اختيار مقاس واحد على الأقل قبل التوزيع");
      }
      const nonWildcard = sizes.filter((s) => s.size !== "*");
      if (nonWildcard.length === 0) {
        throw new Error("يجب اختيار مقاس واحد على الأقل قبل التوزيع");
      }
    }

    // M10.9b: validate each size's qty against its min limit
    if (!isWildcard) {
      for (const s of sizes) {
        const limit = sizeLimits[s.size] ?? 1;
        if (s.qty < limit) {
          throw new Error(
            `الكمية المطلوبة من المقاس "${s.size}" (${s.qty}) أقل من الحد الأدنى (${limit})`
          );
        }
      }
    }

    // Group variants by size
    type VData = (typeof variantData)[number];
    const groups = new Map<string, VData[]>();
    if (isWildcard) {
      groups.set("*", variantData);
    } else {
      for (const s of sizes) {
        groups.set(
          s.size,
          variantData.filter((v) => v.sizeValue === s.size)
        );
      }
    }

    const resultVariants: VariantDistribution[] = [];
    let totalQty = 0;
    let totalDistributed = 0;
    const minDistributedValues: number[] = [];

    for (const sizeEntry of sizes) {
      const group = groups.get(sizeEntry.size) ?? [];
      if (group.length === 0) continue;

      const maxStock = Math.max(0, ...group.map((v) => v.stock));
      const withWeights = group.map((v) => ({
        ...v,
        weight: maxStock > 0 ? v.stock / maxStock : 0,
        isRare:
          maxStock > 0 ? v.stock / maxStock < config.rareThreshold : false,
      }));

      const distributableAll = withWeights.filter(
        (v) => !v.isRare && v.stock > 0
      );
      const sumWeight = distributableAll.reduce((s, v) => s + v.weight, 0);

      const baseMap = new Map<number, number>();
      const rawMap = new Map<number, number>();

      if (sumWeight > 0) {
        for (const v of distributableAll) {
          const raw = (sizeEntry.qty * v.weight) / sumWeight;
          rawMap.set(v.variantId, raw);
          baseMap.set(v.variantId, roundWithThreshold(raw, config.roundThreshold));
        }

        // Fix sum on the largest-stock variant
        let sumRounded = 0;
        for (const q of baseMap.values()) sumRounded += q;
        const delta = sizeEntry.qty - sumRounded;
        if (delta !== 0 && distributableAll.length > 0) {
          const largest = distributableAll.reduce(
            (best, v) => (v.stock > best.stock ? v : best),
            distributableAll[0]
          );
          baseMap.set(
            largest.variantId,
            Math.max(0, (baseMap.get(largest.variantId) ?? 0) + delta)
          );
        }

        // Cap by stock
        for (const v of distributableAll) {
          const q = baseMap.get(v.variantId) ?? 0;
          baseMap.set(v.variantId, Math.min(q, v.stock));
        }
      }

      // minDistributed within this size
      const nonRareQtys: number[] = [];
      for (const v of distributableAll) {
        const q = baseMap.get(v.variantId) ?? 0;
        if (q > 0) nonRareQtys.push(q);
      }
      const sizeMin =
        nonRareQtys.length > 0 ? Math.min(...nonRareQtys) : 0;
      if (sizeMin > 0) minDistributedValues.push(sizeMin);

      // Build result variants for this size
      for (const v of withWeights) {
        const baseQty = baseMap.get(v.variantId) ?? 0;
        totalDistributed += baseQty;

        let minAllowed: number;
        let maxAllowed: number;
        let variantMaxAdjust: number;

        if (v.isRare) {
          // Rare: base=0, can add manually up to sizeMin (from non-rare)
          minAllowed = 0;
          maxAllowed = Math.min(v.stock, sizeMin);
          variantMaxAdjust = 0; // maxAdjust doesn't apply; sizeMin is the cap
        } else {
          minAllowed = Math.max(0, baseQty - maxAdjust);
          maxAllowed = Math.min(v.stock, baseQty + maxAdjust);
          variantMaxAdjust = maxAdjust;
        }

        resultVariants.push({
          variantId: v.variantId,
          merchantVariantId: v.merchantVariantId,
          attributes: v.attributes,
          sizeValue: v.sizeValue,
          stock: v.stock,
          weight: v.weight,
          isRare: v.isRare,
          isBlocked: false,
          baseQty,
          suggestedQty: baseQty,
          minAllowed,
          maxAllowed,
          maxAdjust: variantMaxAdjust,
          rawQuantity: Math.round((rawMap.get(v.variantId) ?? 0) * 100) / 100,
        });
      }

      totalQty += sizeEntry.qty;
    }

    // Add unselected sizes as blocked (only in per-size mode)
    if (!isWildcard) {
      const selectedSizeSet = new Set(sizes.map((s) => s.size));
      for (const v of variantData) {
        if (resultVariants.some((r) => r.variantId === v.variantId)) continue;
        if (v.sizeValue && !selectedSizeSet.has(v.sizeValue)) {
          resultVariants.push({
            variantId: v.variantId,
            merchantVariantId: v.merchantVariantId,
            attributes: v.attributes,
            sizeValue: v.sizeValue,
            stock: v.stock,
            weight: 0,
            isRare: false,
            isBlocked: true,
            baseQty: 0,
            suggestedQty: 0,
            minAllowed: 0,
            maxAllowed: 0,
            maxAdjust: 0,
            rawQuantity: 0,
          });
        }
      }
    }

    const globalMin =
      minDistributedValues.length > 0
        ? Math.min(...minDistributedValues)
        : 0;

    return {
      totalQty,
      totalDistributed,
      minDistributed: globalMin,
      maxStock: Math.max(0, ...variantData.map((v) => v.stock)),
      availableSizes,
      sizeFilterApplied: isWildcard ? null : sizes.map((s) => s.size),
      requireSizeSelection: offer.requireSizeSelection,
      maxManualAdjustment: maxAdjust,
      sizeLimits,
      variants: resultVariants,
      config,
    };
  },

  async recompute(offerId: number): Promise<void> {
    await prisma.wholesaleOffer.update({
      where: { id: offerId },
      data: { autoBalanceUpdatedAt: new Date() },
    });
  },

  /**
   * M10.9b: bulk set per-size min order limits.
   * Replaces all existing limits for the offer.
   */
  async setSizeLimits(
    offerId: number,
    limits: Array<{ size: string; minOrderQty: number }>
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.wholesaleOfferSizeLimit.deleteMany({ where: { offerId } });
      if (limits.length > 0) {
        await tx.wholesaleOfferSizeLimit.createMany({
          data: limits
            .filter((l) => l.size && l.minOrderQty >= 1)
            .map((l) => ({
              offerId,
              size: l.size,
              minOrderQty: l.minOrderQty,
            })),
        });
      }
    });
  },

  /**
   * M10.9b: get all size limits for an offer as a Record<size, minOrderQty>.
   */
  async getSizeLimits(offerId: number): Promise<Record<string, number>> {
    const rows = await prisma.wholesaleOfferSizeLimit.findMany({
      where: { offerId },
      select: { size: true, minOrderQty: true },
    });
    const out: Record<string, number> = {};
    for (const r of rows) out[r.size] = r.minOrderQty;
    return out;
  },
};