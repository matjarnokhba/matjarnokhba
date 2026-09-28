import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthService } from "@/services/auth.service";
import { rateLimit, getClientIp, formatRetryAfter } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // ═══════ Rate Limit ═══════
    const ip = getClientIp(request);
    const limit = rateLimit(`register:${ip}`, 3, 60 * 60 * 1000); // 3 محاولات/ساعة

    if (!limit.success) {
      return NextResponse.json(
        {
          success: false,
          message: `محاولات كثيرة. حاول بعد ${formatRetryAfter(limit.retryAfterMs)}.`,
          retryAfterMs: limit.retryAfterMs,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
          },
        }
      );
    }

    // 1. اقرأ البيانات من الطلب
    const body = await request.json();

    // 2. سجّل المستخدم عبر AuthService
    const user = await AuthService.register(body);

    // 3. أرجع النتيجة
    return NextResponse.json(
      {
        success: true,
        message: "تم إنشاء الحساب بنجاح",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    // معالجة أخطاء Zod (التحقق من البيانات)
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "بيانات غير صحيحة",
          errors: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    // معالجة باقي الأخطاء (البريد مكرر، ...)
    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 400 }
      );
    }

    // خطأ غير متوقع
    console.error("Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ غير متوقع",
      },
      { status: 500 }
    );
  }
}