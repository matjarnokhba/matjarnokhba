import { NextResponse } from "next/server";
import { AuthService } from "@/services/auth.service";
import {
  rateLimit,
  getClientIp,
  resetRateLimit,
  formatRetryAfter,
} from "@/lib/rate-limit";

// ═══════ الحدود ═══════
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 دقيقة

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimitKey = `login:${ip}`;

    // ═══════ فحص Rate Limit ═══════
    const limit = await rateLimit(rateLimitKey, MAX_ATTEMPTS, WINDOW_MS);

    if (!limit.success) {
      return NextResponse.json(
        {
          success: false,
          message: `محاولات كثيرة جداً. حاول بعد ${formatRetryAfter(limit.retryAfterMs)}.`,
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

    const body = await request.json();
    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "البريد وكلمة المرور مطلوبان" },
        { status: 400 }
      );
    }

    // ═══════ محاولة الدخول ═══════
    let user;
    try {
      user = await AuthService.login({ email, password });
    } catch (authError) {
      // ═══ فشل تسجيل الدخول — نعيد رسالة المنطق ═══
      const message =
        authError instanceof Error
          ? authError.message
          : "البريد أو كلمة المرور غير صحيحة";

      return NextResponse.json(
        {
          success: false,
          message,
          attemptsLeft: limit.remaining,
        },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "البريد أو كلمة المرور غير صحيحة",
          attemptsLeft: limit.remaining,
        },
        { status: 401 }
      );
    }

    // ═══════ نجاح → صفّر العدّاد ═══════
    await resetRateLimit(rateLimitKey);

    // ═══════ إنشاء الجلسة ═══════
    const { SessionService } = await import("@/services/session.service");
    const userAgent = request.headers.get("user-agent") || undefined;
    await SessionService.create(user.id, userAgent);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}