import { NextResponse } from "next/server";
import { LogisticsAdminService } from "@/services/logistics-admin.service";
import { logisticsErrorResponse, parseId, zodMessage } from "@/lib/logistics-route";import { requireLogisticsPlatform } from "@/lib/logistics-guards";

export async function GET(request: Request) {
  try {
    const g = await requireLogisticsPlatform();
    if (!g.ok) return g.response;
    const sp = new URL(request.url).searchParams;
    const entityType = sp.get("entityType") ?? undefined;
    const entityId = parseId(sp.get("entityId")) ?? undefined;
    const logs = await LogisticsAdminService.listAudit({ entityType, entityId });
    return NextResponse.json({ success: true, logs });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}