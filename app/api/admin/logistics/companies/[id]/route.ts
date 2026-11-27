import { NextResponse } from "next/server";
import { LogisticsAdminService } from "@/services/logistics-admin.service";
import { logisticsErrorResponse, parseId, zodMessage } from "@/lib/logistics-route";import { requireLogisticsPlatform } from "@/lib/logistics-guards";
import { companyUpdateSchema } from "@/lib/logistics-validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await requireLogisticsPlatform();
    if (!g.ok) return g.response;
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ success: false, message: "معرّف غير صحيح" }, { status: 400 });
    const p = companyUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const company = await LogisticsAdminService.updateCompany({ id: g.userId, scope: g.scope }, id, p.data);
    return NextResponse.json({ success: true, company });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}