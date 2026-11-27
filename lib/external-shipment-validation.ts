import { z } from "zod";
import { CANONICAL_STATUSES } from "@/lib/integration-status";

export const dispatchSchema = z.object({
  shipmentId: z.number().int().positive(),
  providerId: z.number().int().positive(),
});

export const externalActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("retry") }),
  z.object({
    action: z.literal("set_tracking"),
    trackingNumber: z.string().trim().min(3).max(100).optional(),
    externalId: z.string().trim().min(1).max(100).optional(),
  }),
  z.object({
    action: z.literal("add_event"),
    rawStatus: z.string().trim().min(1).max(100),
    canonicalStatus: z.enum(CANONICAL_STATUSES).optional(),
    occurredAt: z.string().datetime().optional(),
  }),
]);

export type DispatchInput = z.infer<typeof dispatchSchema>;
export type ExternalAction = z.infer<typeof externalActionSchema>;