import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  parseJson,
  handleError,
  withIdempotency,
  ok,
} from "@/lib/api";
import { BusinessUnitService } from "@/services/business-unit.service";

const createSchema = z.object({
  name: z.string().trim().min(2, "اسم النشاط مطلوب").max(200),
  type: z.enum([
    "FACTORY", "SHOP", "BRANCH", "IMPORTER", "WHOLESALER", "DISTRIBUTOR",
  ]),
  activityType: z.string().trim().max(100).optional(),
  description: z.string().trim().max(2000).optional(),
  logo: z.string().url().optional(),
  capabilities: z
    .array(z.enum(["RETAIL", "WHOLESALE_BUY", "WHOLESALE_SELL"]))
    .min(1, "اختر صلاحية واحدة على الأقل"),
  legalEntity: z
    .object({
      name: z.string().trim().min(2).max(200),
      registrationNumber: z.string().trim().max(50).optional(),
      taxId: z.string().trim().max(50).optional(),
      country: z.string().trim().max(2).optional(),
      address: z.string().trim().max(500).optional(),
    })
    .optional(),
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
      "POST:/api/wholesale/business-units",
      parsed.data,
      async () => {
        const businessUnitId = await BusinessUnitService.create(
          auth.current.user.id,
          parsed.data
        );
        return { data: { businessUnitId }, status: 201 };
      }
    );
  } catch (err) {
    return handleError(err, "POST /wholesale/business-units");
  }
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const items = await BusinessUnitService.list(auth.current.user.id);
    return ok({ items });
  } catch (err) {
    return handleError(err, "GET /wholesale/business-units");
  }
}