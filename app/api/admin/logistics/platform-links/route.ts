import { NextResponse } from "next/server";
import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { logisticsErrorResponse, parseId, zodMessage } from "@/lib/logistics-route";
import { linkCreateSchema } from "@/lib/logistics-tenancy-validation";
import { LogisticsTenancyService } from "@/services/logistics-tenancy.service";

export async function GET(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const sp = new URL(request.url).searchParams;
    const links = await LogisticsTenancyService.listLinks(
      { id: g.userId, scope: g.scope },
      { companyId: parseId(sp.get("companyId")) ?? undefined, platformId: parseId(sp.get("platformId")) ?? undefined }
    );
    return NextResponse.json({ success: true, links });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const p = linkCreateSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const link = await LogisticsTenancyService.createLink({ id: g.userId, scope: g.scope }, p.data);
    return NextResponse.json({ success: true, link }, { status: 201 });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}