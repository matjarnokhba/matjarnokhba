import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { logisticsErrorResponse, zodMessage } from "@/lib/logistics-route";
import { CourierCsvService } from "@/services/courier-csv.service";

export const maxDuration = 60;

const bodySchema = z.object({
  providerId: z.number().int().positive(),
  csv: z.string().min(1).max(1_000_000),
});

export async function POST(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const p = bodySchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const result = await CourierCsvService.import({ id: g.userId, scope: g.scope }, p.data.providerId, p.data.csv);
    return NextResponse.json({ success: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}