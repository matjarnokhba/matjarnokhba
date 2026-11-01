import { z } from "zod";

export const RETURN_REASONS = [
  "DAMAGED",
  "WRONG_PRODUCT",
  "NOT_AS_DESCRIBED",
  "QUALITY_ISSUE",
  "OTHER",
] as const;

export const RETURN_REASON_LABELS: Record<string, string> = {
  DAMAGED: "منتج تالف",
  WRONG_PRODUCT: "منتج مختلف",
  NOT_AS_DESCRIBED: "مخالف للوصف",
  QUALITY_ISSUE: "مشكلة جودة",
  OTHER: "أخرى",
};

export const returnItemSchema = z.object({
  orderItemId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  condition: z.string().trim().max(50).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const returnCreateSchema = z.object({
  reason: z.enum(RETURN_REASONS),
  reasonDetails: z.string().trim().max(1000).optional().nullable(),
  items: z.array(returnItemSchema).min(1).max(100),
});

export const returnActionSchema = z.object({
  action: z.enum(["approve", "reject", "receive", "refund", "cancel"]),
  approvedAmount: z.number().positive().optional().nullable(),
  sellerNotes: z.string().trim().max(1000).optional().nullable(),
  rejectionReason: z.string().trim().max(1000).optional().nullable(),
});

export const TERMINAL_RETURN_STATUSES = ["REJECTED", "REFUNDED", "CANCELLED"] as const;

export function isTerminalReturn(status: string): boolean {
  return (TERMINAL_RETURN_STATUSES as readonly string[]).includes(status);
}