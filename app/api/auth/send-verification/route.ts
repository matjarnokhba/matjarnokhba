import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { EmailService } from "@/services/email.service";
import { rateLimit, formatRetryAfter } from "@/lib/rate-limit";

// إرسال رابط تأكيد البريد للمستخدم المسجَّل دخوله (من قائمة الحساب)
// 3 محاولات لكل مستخدم في 15 دقيقة
const MAX_ATTEMPTS = 3;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST() {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: current.user.id },
      select: { id: true, name: true, email: true, emailVerified: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
    }
    if (user.emailVerified) {
      return NextResponse.json({ success: true, alreadyVerified: true, message: "بريدك مؤكد بالفعل" });
    }

    const limit = await rateLimit(`send-verify:user:${user.id}`, MAX_ATTEMPTS, WINDOW_MS);
    if (!limit.success) {
      return NextResponse.json(
        { success: false, message: `محاولات كثيرة. حاول بعد ${formatRetryAfter(limit.retryAfterMs)}.` },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } }
      );
    }

    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken, emailVerificationExpiresAt },
    });

    try {
      await EmailService.sendVerificationEmail(user.email, user.name, emailVerificationToken);
    } catch (err) {
      console.error("Send verification email failed:", err);
      return NextResponse.json(
        { success: false, message: "تعذر إرسال الرسالة الآن، حاول لاحقاً" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, email: user.email, message: "تم إرسال رابط التأكيد" });
  } catch (error) {
    console.error("Send verification error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ مؤقت. حاول لاحقاً." }, { status: 500 });
  }
}