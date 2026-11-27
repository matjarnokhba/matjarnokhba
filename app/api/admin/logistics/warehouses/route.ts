import { NextResponse } from "next/server";
import { LogisticsAdminService } from "@/services/logistics-admin.service";
import { logisticsErrorResponse, parseId, zodMessage } from "@/lib/logistics-route";import { requireLogisticsPlatform } from "@/lib/logistics-guards";
import { warehouseCreateSchema } from "@/lib/logistics-validation";

export async function GET(request: Request) {
  try {
    const g = await requireLogisticsPlatform();
    if (!g.ok) return g.response;
    const companyId = parseId(new URL(request.url).searchParams.get("companyId"));
    const warehouses = await LogisticsAdminService.listWarehouses(companyId ?? undefined);
    return NextResponse.json({ success: true, warehouses });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const g = await requireLogisticsPlatform();
    if (!g.ok) return g.response;
    const p = warehouseCreateSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const warehouse = await LogisticsAdminService.createWarehouse({ id: g.userId, scope: g.scope }, p.data);
    return NextResponse.json({ success: true, warehouse }, { status: 201 });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}