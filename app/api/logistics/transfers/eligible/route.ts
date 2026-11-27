import { NextResponse } from "next/server";
import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { logisticsErrorResponse, parseId } from "@/lib/logistics-route";
import { WarehouseTransferService } from "@/services/warehouse-transfer.service";

export async function GET(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const wid = parseId(new URL(request.url).searchParams.get("warehouseId"));
    if (!wid) return NextResponse.json({ success: false, message: "المستودع مطلوب" }, { status: 400 });
    const items = await WarehouseTransferService.eligibleItems({ id: g.userId, scope: g.scope }, wid);
    return NextResponse.json({ success: true, items });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}