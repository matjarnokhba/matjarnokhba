import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
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

    // 3. شف​ر كلمة المرور
    const passwordHash = await bcrypt.hash(data.password, 12);

    // 4. أنشئ المستخدم في قاعدة البيانات
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        phone: data.phone || null,
        role: "CUSTOMER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

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
    };
  },
};