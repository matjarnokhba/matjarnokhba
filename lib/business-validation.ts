import { z } from "zod";

export const businessTypeSchema = z.enum([
  "INDEPENDENT_SUPPLIER",
  "WHOLESALE_TRADER",
]);

export const businessCreateSchema = z.object({
  type: businessTypeSchema,
  name: z.string().trim().min(2).max(200),
  legalName: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  logo: z.string().url().optional().nullable(),
  commercialRegister: z.string().trim().max(50).optional().nullable(),
  taxId: z.string().trim().max(50).optional().nullable(),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().max(300).optional().nullable(),
  phone: z.string().trim().min(6).max(20),
  email: z.string().email().optional().nullable(),
  linkedSellerId: z.number().int().positive().optional().nullable(),
});

export const businessUpdateSchema = businessCreateSchema
  .partial()
  .omit({ type: true, linkedSellerId: true });

export const businessMemberInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["MANAGER", "SALES", "ACCOUNTANT", "INVENTORY"]),
  permissions: z.record(z.string(), z.boolean()).optional().nullable(),
});

export const businessDocumentSchema = z.object({
  type: z.enum([
    "COMMERCIAL_REGISTER",
    "TAX_CERT",
    "ID_CARD",
    "PATENTE",
    "OTHER",
  ]),
  url: z.string().url(),
  notes: z.string().trim().max(500).optional().nullable(),
});