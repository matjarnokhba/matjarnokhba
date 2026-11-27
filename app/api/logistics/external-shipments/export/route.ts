import { NextResponse } from "next/server";
import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { logisticsErrorResponse } from "@/lib/logistics-route";
import { CourierCsvService } from "@/services/courier-csv.service";

export async function GET(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const providerId = Number(new URL(request.url).searchParams.get("providerId"));
    if (!Number.isInteger(providerId) || providerId <= 0) return NextResponse.json({ success: false, message: "اختر شركة التوصيل" }, { status: 400 });
    const r = await CourierCsvService.export({ id: g.userId, scope: g.scope }, providerId);
    return new Response("\uFEFF" + r.csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="' + r.filename + '"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}