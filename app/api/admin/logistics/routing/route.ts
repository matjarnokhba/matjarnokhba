import { NextResponse } from "next/server";
import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { logisticsErrorResponse, zodMessage } from "@/lib/logistics-route";
import { routingConfigSchema } from "@/lib/logistics-routing-validation";
import { LogisticsRoutingService } from "@/services/logistics-routing.service";

export async function GET() {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const platforms = await LogisticsRoutingService.listConfigs({ id: g.userId, scope: g.scope });
    return NextResponse.json({ success: true, platforms });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}

export async function PUT(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const p = routingConfigSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const config = await LogisticsRoutingService.setConfig({ id: g.userId, scope: g.scope }, p.data);
    return NextResponse.json({ success: true, config });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}
