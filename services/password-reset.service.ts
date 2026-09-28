import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // ساعة واحدة

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export const PasswordResetService = {
  // ═══════ إنشاء Token ═══════
  async createToken(email: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // لا نكشف عدم وجود البريد (أمان)
    if (!user || user.deletedAt) return null;

    // حذف أي tokens قديمة غير مستخدمة
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const token = generateToken();
    const tokenHash = hashToken(token);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
      },
    });

    return token;
  },

  // ═══════ التحقق من Token ═══════
  async verifyToken(token: string) {
    const tokenHash = hashToken(token);

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (!record) return null;
    if (record.usedAt) return null;
    if (record.expiresAt < new Date()) return null;

    return record;
  },

  // ═══════ إعادة تعيين كلمة المرور ═══════
  async resetPassword(token: string, newPassword: string) {
    const tokenHash = hashToken(token);

    return prisma.$transaction(async (tx) => {
      const record = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });

      if (!record) throw new Error("الرابط غير صحيح");
      if (record.usedAt) throw new Error("تم استخدام هذا الرابط من قبل");
      if (record.expiresAt < new Date()) throw new Error("انتهت صلاحية الرابط");

      const passwordHash = await bcrypt.hash(newPassword, 12);

      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });

      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      // إلغاء كل الجلسات (أمان)
      await tx.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: "PASSWORD_RESET",
        },
      });

      return { success: true };
    });
  },
  // ═══════ حالة Token (للتشخيص) ═══════
  async getTokenStatus(token: string): Promise<{
    exists: boolean;
    used: boolean;
    expired: boolean;
    reason: string | null;
  }> {
    const tokenHash = hashToken(token);

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      return {
        exists: false,
        used: false,
        expired: false,
        reason: "الرابط غير صحيح",
      };
    }

    if (record.usedAt) {
      return {
        exists: true,
        used: true,
        expired: false,
        reason: "تم استخدام هذا الرابط من قبل. اطلب رابطاً جديداً.",
      };
    }

    if (record.expiresAt < new Date()) {
      return {
        exists: true,
        used: false,
        expired: true,
        reason: "انتهت صلاحية الرابط (ساعة واحدة). اطلب رابطاً جديداً.",
      };
    }

    return { exists: true, used: false, expired: false, reason: null };
  },
};