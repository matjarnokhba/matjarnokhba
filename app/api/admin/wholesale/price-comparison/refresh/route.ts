import { z } from "zod";
import {
  requireAdmin,
  parseJson,
  handleError,
  withIdempotency,
} from "@/lib/api";
import { PriceComparisonService } from "@/services/price-comparison.service";

const refreshSchema = z
  .object({
    masterVariantId: z.number().int().positive().optional(),
    purgeStale: z.boolean().optional(),
  })
  .optional();

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    // Body is optional
    let parsed: any = { ok: true, data: {} };
    try {
      const body = await request.json();
      const result = refreshSchema.safeParse(body);
      if (result.success) parsed = { ok: true, data: result.data ?? {} };
    } catch {}

    return await withIdempotency(
      request,
      auth.current.user.id,
      "POST:/api/admin/wholesale/price-comparison/refresh",
      parsed.data,
      async () => {
        if (parsed.data?.masterVariantId) {
          const rows = await PriceComparisonService.refreshForVariant(
            undefined,
            parsed.data.masterVariantId
          );
          return { data: { refreshed: 1, rows } };
        }
        const result = await PriceComparisonService.refreshAll();
        let purged = 0;
        if (parsed.data?.purgeStale) {
          const p = await PriceComparisonService.purgeStale();
          purged = p.purged;
        }
        return { data: { ...result, purged } };
      }
    );
  } catch (err) {
    return handleError(err, "POST /admin/wholesale/price-comparison/refresh");
  }
}