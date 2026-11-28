import { NextResponse } from "next/server";
import { logisticsErrorResponse, zodMessage } from "@/lib/logistics-route";
import { companyApplySchema } from "@/lib/logistics-application-validation";
import { LogisticsApplicationService } from "@/services/logistics-application.service";
import { rateLimit, getClientIp, formatRetryAfter } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const limit = await rateLimit(`logistics-apply:${getClientIp(request)}`, 3, 60 * 60 * 1000);
    if (!limit.success) {
      return NextResponse.json({ success: false, message: `محاولات كثيرة. حاول بعد ${formatRetryAfter(limit.retryAfterMs)}.` }, { status: 429 });
    }
    const p = companyApplySchema.safeParse(await request.json().catch(() => null));
    if (!p.success) return NextResponse.json({ success: false, message: zodMessage(p.error) }, { status: 400 });
    const r = await LogisticsApplicationService.apply(p.data);
    return NextResponse.json({ success: true, message: "تم استلام طلبك. ستراجعه الإدارة وتُعلمك بالنتيجة.", company: { id: r.company.id, name: r.company.name } }, { status: 201 });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}
