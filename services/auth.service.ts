import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { ReferralService } from "@/services/referral.service";
import { EmailService } from "@/services/email.service";
import {
  registerSchema,
  loginSchema,
  type RegisterInput,
  type LoginInput,
} from "@/lib/validations/auth";

export const AuthService = {
  // ═══════════════════════════════════════════
  // تسجيل مستخدم جديد
  // ═══════════════════════════════════════════
  async register(input: RegisterInput) {
    // 1. تحقق من صحة البيانات
    const data = registerSchema.parse(input);

    // 2. تأكد أن البريد غير مسجل
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error("البريد الإلكتروني مسجل بالفعل");
    }

    // 3. شفر كلمة المرور
    const passwordHash = await bcrypt.hash(data.password, 12);

    // 4. ولّد كود إحالة فريد للمستخدم الجديد
    const referralCode = await ReferralService.generateUniqueCode();

    // 5. توليد رمز تأكيد البريد
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");

    // 6. أنشئ المستخدم
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        phone: data.phone || null,
        role: "CUSTOMER",
        referralCode,
        emailVerificationToken,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        emailVerified: true,
      },
    });

    // 7. إرسال إيميل التأكيد (في الخلفية لا نوقف التسجيل إذا فشل)
    try {
      await EmailService.sendVerificationEmail(
        user.email,
        user.name,
        emailVerificationToken
      );
    } catch (err) {
      console.error("Verification email failed:", err);
    }

    // 8. ربط الإحالة إن وُجد كود
    const incomingCode = data.referralCode;
    if (incomingCode && typeof incomingCode === "string" && incomingCode.trim()) {
      try {
        await ReferralService.linkReferral(user.id, incomingCode);
      } catch (err) {
        console.error("Referral link failed:", err);
      }
    }

    return user;
  },

  // ═══════════════════════════════════════════
  // تسجيل الدخول
  // ═══════════════════════════════════════════
  async login(input: LoginInput) {
    // 1. تحقق من صحة البيانات
    const data = loginSchema.parse(input);

    // 2. ابحث عن المستخدم
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    // 3. تحقق: المستخدم موجود وغير محذوف
    if (!user || user.deletedAt) {
      throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    }

    // 4. تحقق من كلمة المرور
    const isValidPassword = await bcrypt.compare(
      data.password,
      user.passwordHash
    );

    if (!isValidPassword) {
      throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    }

    // 5. أعد بيانات المستخدم (بدون passwordHash)
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      emailVerified: user.emailVerified,
    };
  },
};