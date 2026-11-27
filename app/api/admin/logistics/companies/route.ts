import { NextResponse } from "next/server";
import { LogisticsAdminService } from "@/services/logistics-admin.service";
import { logisticsErrorResponse, parseId, zodMessage } from "@/lib/logistics-route";import { requireLogisticsPlatform } from "@/lib/logistics-guards";
import { companyCreateSchema } from "@/lib/logistics-validation";

export async function GET() {
  try {
    const g = await requireLogisticsPlatform();
    if (!g.ok) return g.response;
    const companies = await LogisticsAdminService.listCompanies();
    return NextResponse.json({ success: true, companies });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const g = await requireLogisticsPlatform();
    if (!g.ok) return g.response;
    const p = companyCreateSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const company = await LogisticsAdminService.createCompany({ id: g.userId, scope: g.scope }, p.data);
    return NextResponse.json({ success: true, company }, { status: 201 });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}