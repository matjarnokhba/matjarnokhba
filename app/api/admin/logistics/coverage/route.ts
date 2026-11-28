import { NextResponse } from "next/server";
import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { logisticsErrorResponse, zodMessage } from "@/lib/logistics-route";
import { coverageSetSchema } from "@/lib/logistics-routing-validation";
import { LogisticsRoutingService } from "@/services/logistics-routing.service";

export async function GET() {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const data = await LogisticsRoutingService.listCoverage({ id: g.userId, scope: g.scope });
    return NextResponse.json({ success: true, ...data });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}

export async function PUT(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const p = coverageSetSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const result = await LogisticsRoutingService.setCoverage({ id: g.userId, scope: g.scope }, p.data);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}
