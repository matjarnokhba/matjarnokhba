import { NextResponse } from "next/server";
import { supplierRegistrationSchema } from "@/lib/wholesale-registration-validation";
import { WholesaleRegistrationService } from "@/services/wholesale-registration.service";
import { SessionService } from "@/services/session.service";
import { rateLimit, getClientIp, formatRetryAfter } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // Rate limit (3 registrations per hour per IP)
    const ip = getClientIp(request);
    const limit = await rateLimit(`wholesale-register:${ip}`, 3, 60 * 60 * 1000);
    if (!limit.success) {
      return NextResponse.json(
        {
          success: false,
          message: `محاولات كثيرة. حاول بعد ${formatRetryAfter(limit.retryAfterMs)}.`,
          retryAfterMs: limit.retryAfterMs,
        },
        { status: 429, headers: { "Retry-After": String(Math.ceil((limit.retryAfterMs || 60000) / 1000)) } }
      );
    }

    const body = await request.json();
    const parsed = supplierRegistrationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const result = await WholesaleRegistrationService.registerSupplier(parsed.data);

    // Auto-login
    const userAgent = request.headers.get("user-agent") || undefined;
    await SessionService.create(result.userId, userAgent);

    return NextResponse.json(
      {
        success: true,
        message: "تم إنشاء حساب المورد بنجاح. سيتم توثيق نشاطك خلال 24-48 ساعة.",
        businessId: result.businessId,
        businessName: result.businessName,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Wholesale registration error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ أثناء التسجيل";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}