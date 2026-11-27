import { NextResponse } from "next/server";
import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { logisticsErrorResponse, zodMessage } from "@/lib/logistics-route";
import { platformCreateSchema } from "@/lib/logistics-tenancy-validation";
import { ClientPlatformService } from "@/services/client-platform.service";

export async function GET() {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const platforms = await ClientPlatformService.list({ id: g.userId, scope: g.scope });
    return NextResponse.json({ success: true, platforms });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const p = platformCreateSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const r = await ClientPlatformService.create({ id: g.userId, scope: g.scope }, p.data);
    return NextResponse.json({ success: true, platform: r.platform, apiKey: r.apiKey, notice: "احفظ المفتاح الآن؛ لن يُعرض مرة أخرى" }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}