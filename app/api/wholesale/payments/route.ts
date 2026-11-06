import { z } from "zod";
import {
  requireAuth,
  parseJson,
  handleError,
  withIdempotency,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { WholesalePaymentService } from "@/services/wholesale-payment.service";

const allocationSchema = z.object({
  invoiceId: z.number().int().positive(),
  amount: z.number().positive().max(99999999.99),
});

const createSchema = z.object({
  businessUnitId: z.number().int().positive(),
  counterpartyBusinessUnitId: z.number().int().positive().optional().nullable(),
  amount: z.number().positive().max(99999999.99),
  method: z.string().trim().min(2, "طريقة الدفع مطلوبة").max(50),
  currency: z.string().length(3).default("MAD"),
  notes: z.string().trim().max(2000).optional().nullable(),
  groupId: z.number().int().positive().optional().nullable(),
  allocations: z.array(allocationSchema).optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const parsed = await parseJson(request, createSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      "POST:/api/wholesale/payments",
      parsed.data,
      async () => {
        const paymentId = await prisma.$transaction(async (tx) => {
          return await WholesalePaymentService.createPayment(tx, {
            businessUnitId: parsed.data.businessUnitId,
            counterpartyBusinessUnitId:
              parsed.data.counterpartyBusinessUnitId ?? null,
            amount: parsed.data.amount,
            method: parsed.data.method,
            currency: parsed.data.currency,
            notes: parsed.data.notes ?? undefined,
            groupId: parsed.data.groupId ?? null,
            allocations: parsed.data.allocations,
            userId: auth.current.user.id,
          });
        });
        return { data: { paymentId }, status: 201 };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/payments");
  }
}