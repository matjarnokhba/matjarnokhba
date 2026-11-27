import { NextResponse } from "next/server";
import { requireLogisticsPlatform } from "@/lib/logistics-guards";
import { logisticsErrorResponse, parseId } from "@/lib/logistics-route";
import { ParcelMovementService } from "@/services/parcel-movement.service";

export async function GET(request: Request) {
  try {
    const g = await requireLogisticsPlatform();
    if (!g.ok) return g.response;
    const sp = new URL(request.url).searchParams;
    const et = sp.get("entityType");
    const movements = await ParcelMovementService.list({
      entityType: et === "FULFILLMENT_ITEM" || et === "SHIPMENT" || et === "TRANSFER" ? et : undefined,
      entityId: parseId(sp.get("entityId")) ?? undefined,
      warehouseId: parseId(sp.get("warehouseId")) ?? undefined,
    });
    return NextResponse.json({ success: true, movements });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}