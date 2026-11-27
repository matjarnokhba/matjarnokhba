import { NextResponse } from "next/server";
import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { logisticsErrorResponse, parseId, zodMessage } from "@/lib/logistics-route";
import { transferCreateSchema } from "@/lib/logistics-transfer-validation";
import { WarehouseTransferService } from "@/services/warehouse-transfer.service";

export async function GET(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const sp = new URL(request.url).searchParams;
    const transfers = await WarehouseTransferService.list(
      { id: g.userId, scope: g.scope },
      { status: sp.get("status") ?? undefined, warehouseId: parseId(sp.get("warehouseId")) ?? undefined }
    );
    return NextResponse.json({ success: true, transfers });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const p = transferCreateSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const transfer = await WarehouseTransferService.create({ id: g.userId, scope: g.scope }, p.data);
    return NextResponse.json({ success: true, transfer }, { status: 201 });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}