import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import crypto from "crypto";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const origin = url.origin;

    if (!code) {
      return NextResponse.redirect(new URL("/login?error=google_auth_failed", origin));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${origin}/api/auth/google/callback`;

    // 1. تبادل الكود مع Google للحصول على Access Token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error("Token exchange failed");

    // 2. جلب بيانات المستخدم من Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json();
    if (!googleUser.email) throw new Error("No email from Google");

    // 3. البحث عن المستخدم أو إنشائه
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: googleUser.sub }, { email: googleUser.email }] },
    });

    if (user) {
      // إذا وجدنا الحساب بالبريد لكنه لم يسجل بـ Google من قبل، نربطه
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: googleUser.sub, emailVerified: true },
        });
      }
    } else {
      // إنشاء مستخدم جديد عبر Google
      const referralCode = crypto.randomBytes(4).toString("hex").toUpperCase();
      user = await prisma.user.create({
        data: {
          name: googleUser.name || "مستخدم Google",
          email: googleUser.email,
          googleId: googleUser.sub,
          emailVerified: true,
          role: "CUSTOMER",
          referralCode,
        },
      });
    }

    // 4. إنشاء الجلسة وتسجيل الدخول
    await SessionService.create(user.id);

    // 5. التوجيه للصفحة الرئيسية
    return NextResponse.redirect(new URL("/", origin));
  } catch (error) {
    console.error("Google Callback Error:", error);
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(new URL("/login?error=google_auth_failed", origin));
  }
}