import { NextResponse } from "next/server";
import { LogisticsAdminService } from "@/services/logistics-admin.service";
import { logisticsErrorResponse, parseId, zodMessage } from "@/lib/logistics-route";import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { membershipCreateSchema } from "@/lib/logistics-validation";

export async function GET(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const sp = new URL(request.url).searchParams;
    const memberships = await LogisticsAdminService.listMemberships(
      { id: g.userId, scope: g.scope },
      {
        warehouseId: parseId(sp.get("warehouseId")) ?? undefined,
        companyId: parseId(sp.get("companyId")) ?? undefined,
        userId: parseId(sp.get("userId")) ?? undefined,
        status: sp.get("status") ?? undefined,
      }
    );
    return NextResponse.json({ success: true, memberships });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const p = membershipCreateSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const membership = await LogisticsAdminService.appointMembership({ id: g.userId, scope: g.scope }, p.data);
    return NextResponse.json({ success: true, membership }, { status: 201 });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}