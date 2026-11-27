import { NextResponse } from "next/server";
import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { logisticsErrorResponse } from "@/lib/logistics-route";
import { ExternalShipmentService } from "@/services/external-shipment.service";

export async function GET() {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const health = await ExternalShipmentService.health({ id: g.userId, scope: g.scope });
    return NextResponse.json({ success: true, health }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}