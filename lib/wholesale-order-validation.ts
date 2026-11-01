import { z } from "zod";

export const orderItemSchema = z.object({
  offerVariantId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const orderCreateSchema = z.object({
  sellerBusinessId: z.number().int().positive(),
  items: z.array(orderItemSchema).min(1).max(200),
  shippingCost: z.number().nonnegative().default(0),
  discountAmount: z.number().nonnegative().default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
  estimatedDelivery: z.string().datetime().optional().nullable(),
});

export const orderActionSchema = z.object({
  action: z.enum(["accept", "reject", "prepare", "ship", "deliver", "complete", "cancel"]),
  reason: z.string().trim().max(1000).optional().nullable(),
  trackingNumber: z.string().trim().max(100).optional().nullable(),
  shippingCarrier: z.string().trim().max(100).optional().nullable(),
});

export const orderListSchema = z.object({
  status: z
    .enum([
      "DRAFT",
      "PENDING",
      "ACCEPTED",
      "PREPARING",
      "SHIPPED",
      "DELIVERED",
      "COMPLETED",
      "REJECTED",
      "CANCELLED",
    ])
    .optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(30),
});

export const TERMINAL_STATUSES = ["COMPLETED", "REJECTED", "CANCELLED"] as const;

export const BUYER_ACTIONS = ["deliver", "complete", "cancel"] as const;
export const SELLER_ACTIONS = ["accept", "reject", "prepare", "ship"] as const;

export function isTerminal(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}