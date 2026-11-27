import { z } from "zod";

const reason = z.string().trim().min(3, "السبب مطلوب (3 أحرف على الأقل)").max(300);
const httpsUrl = z.string().trim().url("رابط غير صحيح").max(300).refine((u) => u.startsWith("https://"), "الرابط يجب أن يبدأ بـ https://");

export const platformCreateSchema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9-]{3,30}$/, "الكود: أحرف إنجليزية وأرقام وشرطة (3-30)"),
  name: z.string().trim().min(2, "الاسم مطلوب").max(80),
  contactEmail: z.string().trim().email("بريد غير صحيح").max(120).optional(),
  webhookUrl: httpsUrl.optional(),
  ownerUserId: z.number().int().positive().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const platformActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    name: z.string().trim().min(2).max(80).optional(),
    contactEmail: z.string().trim().email().max(120).optional(),
    webhookUrl: httpsUrl.optional(),
    ownerUserId: z.number().int().positive().optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  z.object({ action: z.literal("suspend"), reason }),
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("revoke"), reason }),
  z.object({ action: z.literal("rotate_key") }),
]);

export const linkCreateSchema = z.object({
  companyId: z.number().int().positive("الشركة مطلوبة"),
  platformId: z.number().int().positive("المنصة مطلوبة"),
  notes: z.string().trim().max(300).optional(),
});

export const linkActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause"), reason }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("revoke"), reason }),
  z.object({ action: z.literal("reinstate") }),
]);

export const brandSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80).optional(),
    logoUrl: httpsUrl.optional(),
    brandColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "اللون بصيغة #RRGGBB").optional(),
    contactPhone: z.string().trim().regex(/^[0-9+\s-]{6,20}$/, "رقم هاتف غير صحيح").optional(),
    contactEmail: z.string().trim().email().max(120).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "لا توجد تغييرات" });

export const externalAccessSchema = z.object({ allow: z.boolean() });
export const driverAssignSchema = z.object({ companyId: z.number().int().positive("الشركة مطلوبة") });

export type PlatformCreateInput = z.infer<typeof platformCreateSchema>;
export type PlatformAction = z.infer<typeof platformActionSchema>;
export type LinkCreateInput = z.infer<typeof linkCreateSchema>;
export type LinkAction = z.infer<typeof linkActionSchema>;
export type BrandInput = z.infer<typeof brandSchema>;