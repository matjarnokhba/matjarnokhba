/**
 * Wholesale System - Common Zod Validators
 */

import { z } from "zod";
import { WHOLESALE_CONFIG } from "./config";

export const idSchema = z.number().int().positive();
export const pageSchema = z.number().int().min(1).default(1);
export const pageSizeSchema = z.number().int().min(1).max(WHOLESALE_CONFIG.MAX_PAGE_SIZE).default(WHOLESALE_CONFIG.DEFAULT_PAGE_SIZE);
export const moneySchema = z.number().nonnegative().max(99999999.99);
export const qtySchema = z.number().int().min(1).max(WHOLESALE_CONFIG.MAX_ORDER_QTY_LIMIT);
export const currencySchema = z.string().length(3).default("MAD");

export const nameSchema = z.string().trim().min(2).max(200);
export const descriptionSchema = z.string().trim().max(2000).optional().nullable();
export const reasonSchema = z.string().trim().max(WHOLESALE_CONFIG.MAX_REASON_LENGTH).optional().nullable();
export const notesSchema = z.string().trim().max(WHOLESALE_CONFIG.MAX_NOTES_LENGTH).optional().nullable();
export const urlSchema = z.string().url();
export const imagesSchema = z.array(urlSchema).max(WHOLESALE_CONFIG.MAX_IMAGES_PER_PRODUCT);

export const attributeSchema = z.object({
  name: z.string().trim().min(1).max(50),
  value: z.string().trim().min(1).max(100),
});

export const attributesSchema = z.array(attributeSchema).max(20);

export const capabilitySchema = z.enum(["RETAIL", "WHOLESALE_BUY", "WHOLESALE_SELL"]);

export const businessTypeSchema = z.enum([
  "FACTORY", "SHOP", "BRANCH", "IMPORTER", "WHOLESALER", "DISTRIBUTOR"
]);

export const registrationStatusSchema = z.enum([
  "REGISTERED", "UNREGISTERED", "NOT_REQUIRED", "PENDING_VERIFICATION"
]);

export const verificationStatusSchema = z.enum([
  "PENDING", "VERIFIED", "REJECTED"
]);

export const reviewLevelSchema = z.enum(["AUTO", "MANUAL", "TRUSTED"]);

export const idempotencyKeySchema = z.string().uuid();
