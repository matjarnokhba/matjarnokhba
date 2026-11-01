import { z } from "zod";

export const supplyActivityCreateSchema = z.object({
  type: z.enum(["FACTORY", "COMPANY", "SUPPLIER", "IMPORTER"]),
  name: z.string().trim().min(2).max(200),
  legalName: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  commercialRegister: z.string().trim().max(50).optional().nullable(),
  taxId: z.string().trim().max(50).optional().nullable(),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().max(300).optional().nullable(),
});

export const supplyActivityUpdateSchema = supplyActivityCreateSchema
  .omit({ type: true })
  .partial();

export const supplyActivityVerifySchema = z.object({
  approve: z.boolean(),
  reason: z.string().trim().max(500).optional().nullable(),
});