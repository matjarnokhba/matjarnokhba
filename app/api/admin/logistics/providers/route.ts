import { NextResponse } from "next/server";
import { requireLogisticsAccess } from "@/lib/logistics-guards";
import { logisticsErrorResponse, zodMessage } from "@/lib/logistics-route";
import { providerCreateSchema } from "@/lib/integration-validation";
import { CourierProviderService } from "@/services/courier-provider.service";

export async function GET() {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const providers = await CourierProviderService.list({ id: g.userId, scope: g.scope });
    return NextResponse.json({ success: true, providers });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const g = await requireLogisticsAccess();
    if (!g.ok) return g.response;
    const p = providerCreateSchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const r = await CourierProviderService.create({ id: g.userId, scope: g.scope }, p.data);
    return NextResponse.json({ success: true, provider: r.provider, webhookSecret: r.webhookSecret, notice: "احفظ سر الـWebhook الآن؛ لن يُعرض مرة أخرى" }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}