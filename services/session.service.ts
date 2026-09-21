import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
} from "@/lib/validations/auth";

// ═══════════════════════════════════════════
// توليد توكن عشوائي آمن
// ═══════════════════════════════════════════
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ═══════════════════════════════════════════
// تشفير التوكن (SHA-256)
// ═══════════════════════════════════════════
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export const SessionService = {
  // ═══════════════════════════════════════════
  // إنشاء جلسة جديدة
  // ═══════════════════════════════════════════
  async create(userId: number, userAgent?: string, ipAddress?: string) {
    // 1. ول​د توكن عشوائي
    const token = generateToken();
    const tokenHash = hashToken(token);

    // 2. أنشئ الجلسة في قاعدة البيانات
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    const session = await prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
      },
    });

    // 3. ضع التوكن في Cookie
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return session;
  },

  // ═══════════════════════════════════════════
  // التحقق من الجلسة الحالية
  // ═══════════════════════════════════════════
  async getCurrent() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) return null;

    const tokenHash = hashToken(token);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt < new Date()) return null;
    if (session.user.deletedAt) return null;

    return {
      session,
      user: session.user,
    };
  },

  // ═══════════════════════════════════════════
  // إلغاء الجلسة الحالية
  // ═══════════════════════════════════════════
  async destroy() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      const tokenHash = hashToken(token);
      await prisma.session.updateMany({
        where: { tokenHash },
        data: {
          revokedAt: new Date(),
          revokedReason: "LOGOUT",
        },
      });
    }

    cookieStore.delete(SESSION_COOKIE_NAME);
  },
};