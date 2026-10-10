import { NextResponse } from "next/server";
import { z } from "zod";
import { PasswordResetService } from "@/services/password-reset.service";
import { rateLimit, getClientIp, formatRetryAfter } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().email("بريد إلكتروني غير صحيح"),
});

export async function POST(request: Request) {
  try {
    // ═══════ Rate Limit ═══════
    const ip = getClientIp(request);
    const limit = await rateLimit(`forgot:${ip}`, 3, 30 * 60 * 1000); // 3 محاولات / 30 دقيقة

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

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const token = await PasswordResetService.createToken(parsed.data.email);

    let resetUrl: string | undefined;

    if (token) {
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      resetUrl = `${baseUrl}/reset-password?token=${token}`;

      // ═══ Logs فقط في بيئة التطوير ═══
      if (process.env.NODE_ENV !== "production") {
        console.log("\n🔑 PASSWORD RESET LINK (DEV ONLY):");
        console.log(resetUrl);
        console.log("");
      }
    }

    return NextResponse.json({
      success: true,
      message: "إذا كان البريد موجوداً، سيصلك رابط لإعادة التعيين",
      ...(process.env.NODE_ENV !== "production" && { resetUrl }),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}