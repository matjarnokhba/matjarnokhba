import { z } from "zod";

export const tierSchema = z.object({
  minQty: z.number().int().positive(),
  maxQty: z.number().int().positive().nullable().optional(),
  unitPrice: z.number().positive(),
});

export const offerVariantSchema = z.object({
  masterVariantId: z.number().int().positive(),
  stock: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative().default(5),
});

export const offerCreateSchema = z.object({
  supplyActivityId: z.number().int().positive().optional(),
  masterId: z.number().int().positive(),
  wholesalePrice: z.number().positive(),
  retailPrice: z.number().positive().optional().nullable(),
  minOrderQty: z.number().int().positive().default(1),
  maxOrderQty: z.number().int().positive().optional().nullable(),
  unit: z.enum(["PIECE", "BOX", "PACK", "KG", "LITER", "METER", "DOZEN"]).default("PIECE"),
  claimType: z.enum(["MANUFACTURER", "DISTRIBUTOR", "RESELLER", "IMPORTER"]).optional(),
  claimProofUrl: z.string().url().optional().nullable(),
  claimNotes: z.string().trim().max(1000).optional().nullable(),
  leadTimeDays: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  tiers: z.array(tierSchema).max(10).default([]),
  variants: z.array(offerVariantSchema).min(1).max(500),
});

export const offerUpdateSchema = offerCreateSchema
  .omit({ masterId: true, claimType: true })
  .partial();

export const offerStatusSchema = z.object({
  action: z.enum(["activate", "pause", "close"]),
});

export const offerVerifySchema = z.object({
  approve: z.boolean(),
  reason: z.string().trim().max(500).optional().nullable(),
});

export function resolveUnitPrice(
  wholesalePrice: number,
  tiers: Array<{ minQty: number; maxQty?: number | null; unitPrice: number }>,
  qty: number
): number {
  const applicable = tiers
    .filter((t) => qty >= t.minQty && (t.maxQty == null || qty <= t.maxQty))
    .sort((a, b) => b.minQty - a.minQty);
  return applicable.length > 0 ? applicable[0].unitPrice : wholesalePrice;
}