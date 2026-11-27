import { NextResponse } from "next/server";
import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { logisticsErrorResponse, parseId, zodMessage } from "@/lib/logistics-route";
import { transferActionSchema } from "@/lib/logistics-transfer-validation";
import { WarehouseTransferService } from "@/services/warehouse-transfer.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ success: false, message: "معرّف غير صحيح" }, { status: 400 });
    const transfer = await WarehouseTransferService.get({ id: g.userId, scope: g.scope }, id);
    return NextResponse.json({ success: true, transfer });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ success: false, message: "معرّف غير صحيح" }, { status: 400 });
    const p = transferActionSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const transfer = await WarehouseTransferService.act({ id: g.userId, scope: g.scope }, id, p.data);
    return NextResponse.json({ success: true, transfer });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}