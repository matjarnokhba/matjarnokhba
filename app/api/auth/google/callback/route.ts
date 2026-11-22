import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import crypto from "crypto";

const STATE_COOKIE = "g_oauth_state";
const STATE_PATH = "/api/auth/google";

function statesMatch(a: string | null, b: string | undefined) {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const fail = (code = "google_auth_failed") =>
    NextResponse.redirect(new URL(`/login?error=${code}`, origin));

  try {
    // 0. التحقق من state (حماية CSRF) — يُستعمل مرة واحدة
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(STATE_COOKIE)?.value;
    cookieStore.set(STATE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: STATE_PATH,
    });
    if (!statesMatch(url.searchParams.get("state"), expectedState)) return fail();

    const code = url.searchParams.get("code");
    if (!code) return fail();

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${origin}/api/auth/google/callback`;

    // 1. تبادل الكود مع Google
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

    // 2. بيانات المستخدم
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json();
    if (!googleUser.sub || !googleUser.email) throw new Error("No email from Google");
    if (googleUser.email_verified !== true && googleUser.email_verified !== "true") {
      throw new Error("Google email not verified");
    }

    // 3. البحث عن المستخدم أو إنشاؤه
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: googleUser.sub }, { email: googleUser.email }] },
    });

    if (user) {
      // حساب مرتبط بحساب Google مختلف → رفض
      if (user.googleId && user.googleId !== googleUser.sub) return fail();

      if (!user.googleId) {
        if (user.emailVerified && user.passwordHash) {
          return fail("google_link_requires_password");
        }
        const updateData: { googleId: string; emailVerified: boolean; passwordHash?: null } = {
          googleId: googleUser.sub,
          emailVerified: true,
        };
        if (user.passwordHash) updateData.passwordHash = null;
        user = await prisma.user.update({ where: { id: user.id }, data: updateData });
      }
    } else {
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

    // 4. الجلسة
    await SessionService.create(user.id);
    return NextResponse.redirect(new URL("/", origin));
  } catch (error) {
    console.error("Google Callback Error:", error);
    return fail();
  }
}