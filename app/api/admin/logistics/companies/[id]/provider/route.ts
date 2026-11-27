import { NextResponse } from "next/server";
import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { logisticsErrorResponse, parseId, zodMessage } from "@/lib/logistics-route";
import { companyProviderSchema } from "@/lib/integration-validation";
import { CourierProviderService } from "@/services/courier-provider.service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ success: false, message: "معرّف غير صحيح" }, { status: 400 });
    const p = companyProviderSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const r = await CourierProviderService.setCompanyProvider({ id: g.userId, scope: g.scope }, id, p.data.providerId);
    return NextResponse.json({ success: true, ...r });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}