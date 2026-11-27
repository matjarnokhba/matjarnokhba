import { NextResponse } from "next/server";
import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { logisticsErrorResponse, parseId, zodMessage } from "@/lib/logistics-route";
import { linkActionSchema } from "@/lib/logistics-tenancy-validation";
import { LogisticsTenancyService } from "@/services/logistics-tenancy.service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ success: false, message: "معرّف غير صحيح" }, { status: 400 });
    const p = linkActionSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const link = await LogisticsTenancyService.actLink({ id: g.userId, scope: g.scope }, id, p.data);
    return NextResponse.json({ success: true, link });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}