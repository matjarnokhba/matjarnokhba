import { z } from "zod";

export const settlementCreateSchema = z.object({
  providerId: z.number().int().positive(),
  reference: z.string().trim().min(1).max(100).optional(),
  received: z.number().min(0).max(100000000),
  notes: z.string().trim().max(500).optional(),
  lines: z
    .array(z.object({ receivableId: z.number().int().positive(), courierFee: z.number().min(0).max(10000000) }))
    .min(1)
    .max(300),
});

export type SettlementCreateInput = z.infer<typeof settlementCreateSchema>;