import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { EmailService } from "@/services/email.service";
import { rateLimit, getClientIp, formatRetryAfter } from "@/lib/rate-limit";

// M12 — إعادة إرسال رابط التحقق من البريد
// Rate limit: 3 محاولات لكل IP في 15 دقيقة
// استجابة موحّدة دائمًا لمنع user enumeration
const MAX_ATTEMPTS = 3;
const WINDOW_MS = 15 * 60 * 1000;

const UNIFORM_MESSAGE =
  "إذا كان البريد مسجلًا لدينا وغير محقق، ستصلك رسالة تأكيد خلال دقائق.";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = await rateLimit(`resend-verify:${ip}`, MAX_ATTEMPTS, WINDOW_MS);

    if (!limit.success) {
      return NextResponse.json(
        {
          success: false,
          message: `محاولات كثيرة. حاول بعد ${formatRetryAfter(limit.retryAfterMs)}.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
          },
        }
      );
    }

    const body = await request.json().catch(() => null);
    const rawEmail = typeof body?.email === "string" ? body.email : "";
    const email = rawEmail.toLowerCase().trim();

    // حتى لو البريد فارغ أو غير صالح — رد موحّد (منع enumeration)
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: true, message: UNIFORM_MESSAGE });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        deletedAt: true,
      },
    });

    // مستخدم غير موجود / محذوف / محقق بالفعل → رد موحّد بلا كشف
    if (!user || user.deletedAt || user.emailVerified) {
      return NextResponse.json({ success: true, message: UNIFORM_MESSAGE });
    }

    // توليد توكن جديد + صلاحية 24 ساعة
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken, emailVerificationExpiresAt },
    });

    // إرسال البريد (بلا كشف فشل الإرسال للمستخدم)
    try {
      await EmailService.sendVerificationEmail(
        user.email,
        user.name,
        emailVerificationToken
      );
    } catch (err) {
      console.error("Resend verification email failed:", err);
    }

    return NextResponse.json({ success: true, message: UNIFORM_MESSAGE });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ مؤقت. حاول لاحقًا." },
      { status: 500 }
    );
  }
}
