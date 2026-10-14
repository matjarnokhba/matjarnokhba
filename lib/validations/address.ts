import { z } from "zod";

// ═══════════════════════════════════════════
// التحقق من رقم الهاتف المغربي
// ═══════════════════════════════════════════
export const moroccanPhoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, "").replace(/-/g, ""))
  .refine(
    (v) =>
      /^(\+212|00212|212|0)(5|6|7)\d{8}$/.test(v),
    "رقم الهاتف المغربي غير صحيح (مثال: 0612345678)"
  )
  .transform((v) => {
    // توحيد الصيغة إلى 0XXXXXXXXX
    if (v.startsWith("+212")) return "0" + v.slice(4);
    if (v.startsWith("00212")) return "0" + v.slice(5);
    if (v.startsWith("212")) return "0" + v.slice(3);
    return v;
  });

// ═══════════════════════════════════════════
// Schema العناوين
// ═══════════════════════════════════════════
export const addressCreateSchema = z.object({
  fullName: z.string().trim().min(2, "الاسم مطلوب (2 أحرف على الأقل)").max(100),
  phone: moroccanPhoneSchema,

  cityId: z.number().int().positive("اختر المدينة"),
  districtId: z.number().int().positive().optional().nullable(),

  street: z.string().trim().min(3, "الشارع مطلوب (3 أحرف على الأقل)").max(200),
  buildingNumber: z.string().trim().max(50).optional().nullable(),
  apartment: z.string().trim().max(50).optional().nullable(),
  landmark: z.string().trim().max(300).optional().nullable(),
  postalCode: z.string().trim().max(10).optional().nullable(),

  isDefault: z.boolean().optional().default(false),
});

export const addressUpdateSchema = addressCreateSchema.partial();