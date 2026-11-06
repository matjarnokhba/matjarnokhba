import { z } from "zod";
import {
  requireAdmin,
  parseJson,
  handleError,
  withIdempotency,
  ok,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  masterCategoryId: z.number().int().positive().optional().nullable(),
  businessUnitType: z.string().trim().max(50).optional().nullable(),
  thresholdPercent: z.number().positive().max(100).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const settings = await prisma.priceAlertSetting.findMany({
      orderBy: [{ isActive: "desc" }, { id: "asc" }],
    });

    const cacheStats = await prisma.priceComparisonCache.aggregate({
      _count: { _all: true },
      _min: { calculatedAt: true },
      _max: { calculatedAt: true },
    });

    return ok({
      settings: settings.map((s) => ({
        ...s,
        thresholdPercent: Number(s.thresholdPercent),
      })),
      cacheStats: {
        total: cacheStats._count._all,
        oldestCalculatedAt: cacheStats._min.calculatedAt,
        newestCalculatedAt: cacheStats._max.calculatedAt,
      },
    });
  } catch (err) {
    return handleError(err, "GET /admin/wholesale/price-alert-settings");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const parsed = await parseJson(request, updateSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      "POST:/api/admin/wholesale/price-alert-settings",
      parsed.data,
      async () => {
        const created = await prisma.priceAlertSetting.create({
          data: {
            masterCategoryId: parsed.data.masterCategoryId ?? null,
            businessUnitType: parsed.data.businessUnitType ?? null,
            thresholdPercent: parsed.data.thresholdPercent ?? 5.0,
            isActive: parsed.data.isActive ?? true,
          },
        });
        return { data: { id: created.id }, status: 201 };
      }
    );
  } catch (err) {
    return handleError(err, "POST /admin/wholesale/price-alert-settings");
  }
}