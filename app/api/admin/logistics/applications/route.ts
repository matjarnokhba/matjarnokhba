import { NextResponse } from "next/server";
import { requireLogisticsPlatform } from "@/lib/logistics-guards";
import { logisticsErrorResponse } from "@/lib/logistics-route";
import { LogisticsApplicationService } from "@/services/logistics-application.service";

export async function GET() {
  try {
    const g = await requireLogisticsPlatform();
    if (!g.ok) return g.response;
    const applications = await LogisticsApplicationService.listApplications({ id: g.userId, scope: g.scope });
    return NextResponse.json({ success: true, applications });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}
