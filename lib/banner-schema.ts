import { z } from "zod";

const safeLink = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || (v.startsWith("/") && !v.startsWith("//")) || /^https?:\/\//i.test(v),
    "الرابط يجب أن يبدأ بـ / أو https://"
  );

const safeImage = z
  .string()
  .trim()
  .min(1, "الصورة مطلوبة")
  .max(1000)
  .refine((v) => /^https?:\/\//i.test(v) || v.startsWith("/"), "رابط الصورة غير صحيح");

const dateStr = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "تاريخ غير صحيح");

export const bannerBase = z.object({
  title: z.string().trim().max(120).nullable().optional(),
  subtitle: z.string().trim().max(250).nullable().optional(),
  buttonText: z.string().trim().max(40).nullable().optional(),
  linkUrl: safeLink.nullable().optional(),
  imageUrl: safeImage,
  mobileImageUrl: safeImage.nullable().optional(),
  order: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
  startsAt: dateStr.nullable().optional(),
  endsAt: dateStr.nullable().optional(),
});

export const bannerCreateSchema = bannerBase;
export const bannerUpdateSchema = bannerBase.partial();

type BannerInput = z.infer<typeof bannerUpdateSchema>;

const nz = (v: string | null | undefined) => (v === undefined ? undefined : v ? v : null);
const dt = (v: string | null | undefined) =>
  v === undefined ? undefined : v ? new Date(v) : null;

// يحوّل المدخلات إلى بيانات Prisma (undefined = لا تغيير)
export function bannerData(d: BannerInput) {
  return {
    title: nz(d.title),
    subtitle: nz(d.subtitle),
    buttonText: nz(d.buttonText),
    linkUrl: nz(d.linkUrl),
    imageUrl: d.imageUrl,
    mobileImageUrl: nz(d.mobileImageUrl),
    order: d.order,
    isActive: d.isActive,
    startsAt: dt(d.startsAt),
    endsAt: dt(d.endsAt),
  };
}