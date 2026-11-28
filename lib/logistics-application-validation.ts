import { z } from "zod";

export const companyApplySchema = z.object({
  name: z.string().trim().min(2, "اسمك يجب أن يكون حرفين على الأقل").max(100),
  email: z.string().trim().email("بريد إلكتروني غير صحيح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").max(100),
  companyName: z.string().trim().min(2, "اسم الشركة قصير جداً").max(80),
  phone: z.string().trim().min(6, "رقم الهاتف غير صحيح").max(20, "رقم الهاتف غير صحيح"),
  city: z.string().trim().max(80).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export const applicationDecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(300).optional().nullable(),
});

export type CompanyApplyInput = z.infer<typeof companyApplySchema>;
export type ApplicationDecisionInput = z.infer<typeof applicationDecisionSchema>;
