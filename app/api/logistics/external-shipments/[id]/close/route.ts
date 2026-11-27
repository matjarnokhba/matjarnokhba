import { NextResponse } from "next/server";
import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { logisticsErrorResponse } from "@/lib/logistics-route";
import { ExternalDeliveryService } from "@/services/external-delivery.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ success: false, message: "معرّف غير صالح" }, { status: 400 });
    const r = await ExternalDeliveryService.close({ id: g.userId, scope: g.scope }, id);
    return NextResponse.json({ success: true, ...r }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}