import { z } from "zod";

const dateStr = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "تاريخ غير صحيح");

export const saleBase = z.object({
  title: z.string().trim().min(1, "العنوان مطلوب").max(80),
  subtitle: z.string().trim().max(200).nullable().optional(),
  startsAt: dateStr,
  endsAt: dateStr,
  isActive: z.boolean().optional(),
  showCountdown: z.boolean().optional(),
  showProgress: z.boolean().optional(),
});

export const saleCreateSchema = saleBase;
export const saleUpdateSchema = saleBase.partial();

export const itemsSchema = z.object({
  productIds: z.array(z.number().int().positive()).max(24, "الحد الأقصى 24 منتجاً"),
});

type SaleInput = z.infer<typeof saleUpdateSchema>;

export function saleData(d: SaleInput) {
  return {
    title: d.title,
    subtitle: d.subtitle === undefined ? undefined : d.subtitle ? d.subtitle : null,
    startsAt: d.startsAt ? new Date(d.startsAt) : undefined,
    endsAt: d.endsAt ? new Date(d.endsAt) : undefined,
    isActive: d.isActive,
    showCountdown: d.showCountdown,
    showProgress: d.showProgress,
  };
}