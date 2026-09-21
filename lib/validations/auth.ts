import { z } from "zod";

// ═══════════════════════════════════════════
// مخطط التسجيل
// ═══════════════════════════════════════════
export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "الاسم يجب أن يكون حرفين على الأقل")
    .max(100, "الاسم طويل جداً"),
  email: z
    .string()
    .email("البريد الإلكتروني غير صالح")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل")
    .max(100, "كلمة المرور طويلة جداً"),
  phone: z
    .string()
    .min(8, "رقم الهاتف غير صالح")
    .optional()
    .or(z.literal("")),
});

// ═══════════════════════════════════════════
// مخطط الدخول
// ═══════════════════════════════════════════
export const loginSchema = z.object({
  email: z
    .string()
    .email("البريد الإلكتروني غير صالح")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, "كلمة المرور مطلوبة"),
});

// ═══════════════════════════════════════════
// أنواع TypeScript من المخططات
// ═══════════════════════════════════════════
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ═══════════════════════════════════════════
// ثوابت الجلسة
// ═══════════════════════════════════════════
export const SESSION_COOKIE_NAME = "nokhba_session";
export const SESSION_DURATION_DAYS = 30;
export const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;