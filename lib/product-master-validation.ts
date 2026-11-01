import { z } from "zod";

export const productMasterCreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  categoryId: z.number().int().positive(),
  brand: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  images: z.array(z.string().url()).min(1).max(10),
  barcode: z.string().trim().min(3).max(100).optional().nullable(),
  qrCode: z.string().trim().min(3).max(200).optional().nullable(),
  specifications: z.record(z.string(), z.any()).optional().nullable(),
  variants: z
    .array(
      z.object({
        sku: z.string().trim().max(50).optional().nullable(),
        barcode: z.string().trim().max(100).optional().nullable(),
        options: z.record(z.string(), z.string()).optional().nullable(),
      })
    )
    .min(1)
    .max(500),
});

export const productMasterUpdateSchema = productMasterCreateSchema
  .omit({ variants: true })
  .partial();

export const productMasterVerifySchema = z.object({
  approve: z.boolean(),
  reason: z.string().trim().max(500).optional().nullable(),
});

export function computeOptionsHash(
  options: Record<string, string> | null | undefined
): string {
  if (!options) return "__default__";
  const sorted = Object.keys(options)
    .sort()
    .map((k) => `${k}=${options[k]}`)
    .join("|");
  return sorted || "__default__";
}