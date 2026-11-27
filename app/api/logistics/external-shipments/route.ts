import { NextResponse } from "next/server";
import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { logisticsErrorResponse, zodMessage } from "@/lib/logistics-route";
import { dispatchSchema } from "@/lib/external-shipment-validation";
import { CANONICAL_STATUSES } from "@/lib/integration-status";
import { ExternalShipmentService } from "@/services/external-shipment.service";

export async function GET(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const sp = new URL(request.url).searchParams;
    const providerId = Number(sp.get("providerId"));
    const status = sp.get("status") ?? "";
    const submitState = sp.get("submitState") ?? "";
    const rows = await ExternalShipmentService.list(
      { id: g.userId, scope: g.scope },
      {
        providerId: Number.isInteger(providerId) && providerId > 0 ? providerId : undefined,
        status: (CANONICAL_STATUSES as readonly string[]).includes(status) ? status : undefined,
        submitState: ["NOT_SUBMITTED", "SUBMITTING", "SUBMITTED", "FAILED", "MANUAL"].includes(submitState) ? submitState : undefined,
      }
    );
    return NextResponse.json({ success: true, externalShipments: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const p = dispatchSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const r = await ExternalShipmentService.dispatch({ id: g.userId, scope: g.scope }, p.data);
    return NextResponse.json({ success: true, ...r }, { status: r.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}