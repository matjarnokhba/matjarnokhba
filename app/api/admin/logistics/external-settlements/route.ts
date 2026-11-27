import { NextResponse } from "next/server";
import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { logisticsErrorResponse, zodMessage } from "@/lib/logistics-route";
import { settlementCreateSchema } from "@/lib/external-settlement-validation";
import { ExternalSettlementService } from "@/services/external-settlement.service";

export async function GET(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const actor = { id: g.userId, scope: g.scope };
    const pid = Number(new URL(request.url).searchParams.get("providerId"));
    const providerId = Number.isInteger(pid) && pid > 0 ? pid : undefined;
    const settlements = await ExternalSettlementService.list(actor, providerId);
    const open = providerId ? await ExternalSettlementService.openReceivables(actor, providerId) : [];
    return NextResponse.json({ success: true, open, settlements }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const p = settlementCreateSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const r = await ExternalSettlementService.create({ id: g.userId, scope: g.scope }, p.data);
    return NextResponse.json({ success: true, settlement: r }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}