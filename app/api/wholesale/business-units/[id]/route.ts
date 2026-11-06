import { z } from "zod";
import {
  requireAuth,
  parseJson,
  handleError,
  withIdempotency,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { BusinessUnitService } from "@/services/business-unit.service";

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    type: z
      .enum([
        "FACTORY", "SHOP", "BRANCH", "IMPORTER", "WHOLESALER", "DISTRIBUTOR",
      ])
      .optional(),
    activityType: z.string().trim().max(100).optional(),
    description: z.string().trim().max(2000).optional(),
    logo: z.string().url().optional(),
    capabilities: z
      .array(z.enum(["RETAIL", "WHOLESALE_BUY", "WHOLESALE_SELL"]))
      .min(1)
      .optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "لا يوجد تغيير");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const businessUnitId = numericParam(id);
    if (!businessUnitId) return fail("معرف غير صحيح", 400);

    const ctx = await BusinessUnitService.get(auth.current.user.id, businessUnitId);
    return ok({
      businessUnit: ctx.businessUnit,
      member: ctx.member,
      isOwner: ctx.isOwner,
    });
  } catch (err) {
    return handleError(err, "GET /wholesale/business-units/[id]");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const businessUnitId = numericParam(id);
    if (!businessUnitId) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, updateSchema);
    if (!parsed.ok) return parsed.response;

    return await withIdempotency(
      request,
      auth.current.user.id,
      `PATCH:/api/wholesale/business-units/${businessUnitId}`,
      parsed.data,
      async () => {
        await BusinessUnitService.update(
          auth.current.user.id,
          businessUnitId,
          parsed.data
        );
        return { data: { updated: true } };
      }
    );
  } catch (err) {
    return handleError(err, "PATCH /wholesale/business-units/[id]");
  }
}