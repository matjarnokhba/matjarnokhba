import { NextResponse } from "next/server";
import { requireLogisticsPlatform } from "@/lib/logistics-guards";
import { logisticsErrorResponse, parseId, zodMessage } from "@/lib/logistics-route";
import { applicationDecisionSchema } from "@/lib/logistics-application-validation";
import { LogisticsApplicationService } from "@/services/logistics-application.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await requireLogisticsPlatform();
    if (!g.ok) return g.response;
    const { id } = await params;
    const companyId = parseId(id);
    if (!companyId) return NextResponse.json({ success: false, message: "معرّف غير صالح" }, { status: 400 });
    const p = applicationDecisionSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const actor = { id: g.userId, scope: g.scope };
    const company = p.data.action === "approve"
      ? await LogisticsApplicationService.approve(actor, companyId)
      : await LogisticsApplicationService.reject(actor, companyId, p.data.reason);
    return NextResponse.json({ success: true, company });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}
