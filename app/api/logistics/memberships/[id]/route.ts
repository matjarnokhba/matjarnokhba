import { NextResponse } from "next/server";
import { LogisticsAdminService } from "@/services/logistics-admin.service";
import { logisticsErrorResponse, parseId, zodMessage } from "@/lib/logistics-route";import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { membershipUpdateSchema } from "@/lib/logistics-validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ success: false, message: "معرّف غير صحيح" }, { status: 400 });
    const p = membershipUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const membership = await LogisticsAdminService.updateMembership({ id: g.userId, scope: g.scope }, id, p.data);
    return NextResponse.json({ success: true, membership });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}