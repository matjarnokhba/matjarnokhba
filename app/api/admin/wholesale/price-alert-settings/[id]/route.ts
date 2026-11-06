import { z } from "zod";
import {
  requireAdmin,
  parseJson,
  handleError,
  withIdempotency,
  fail,
  numericParam,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";

const updateSchema = z
  .object({
    thresholdPercent: z.number().positive().max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "لا يوجد تغيير");

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const settingId = numericParam(id);
    if (!settingId) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, updateSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `PATCH:/api/admin/wholesale/price-alert-settings/${settingId}`,
      parsed.data,
      async () => {
        const exists = await prisma.priceAlertSetting.findUnique({
          where: { id: settingId },
          select: { id: true },
        });
        if (!exists) return { data: { updated: false } };

        await prisma.priceAlertSetting.update({
          where: { id: settingId },
          data: parsed.data,
        });
        return { data: { updated: true } };
      }
    );
  } catch (err) {
    return handleError(
      err,
      "PATCH /admin/wholesale/price-alert-settings/[id]"
    );
  }
}