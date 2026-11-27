import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { CourierWebhookService } from "@/services/courier-webhook.service";

export const dynamic = "force-dynamic";

const MAX_BYTES = 262144;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimit("courierwh:" + ip, 240, 60 * 1000);
    if (!rl.success) {
      return NextResponse.json({ success: false }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) } });
    }
    const { token } = await params;
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return NextResponse.json({ success: false }, { status: 404 });
    const rt = await rateLimit("courierwh-t:" + token, 600, 60 * 1000);
    if (!rt.success) return NextResponse.json({ success: false }, { status: 429 });
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) return NextResponse.json({ success: false }, { status: 413 });
    const raw = await request.text();
    if (raw.length > MAX_BYTES) return NextResponse.json({ success: false }, { status: 413 });
    const r = await CourierWebhookService.handle(token, raw, (n) => request.headers.get(n));
    return NextResponse.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("courier webhook error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}