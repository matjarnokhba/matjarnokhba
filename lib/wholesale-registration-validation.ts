import { z } from "zod";

export const supplierRegistrationSchema = z.object({
  // Account
  accountName: z.string().trim().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  phone: z.string().trim().min(6).max(20),

  // Business
  supplyActivityType: z.enum(["FACTORY", "COMPANY", "SUPPLIER", "IMPORTER"]),
  businessName: z.string().trim().min(2).max(200),
  legalName: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().max(300).optional().nullable(),
  commercialRegister: z.string().trim().max(50).optional().nullable(),
  taxId: z.string().trim().max(50).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
});