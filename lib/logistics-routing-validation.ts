import { z } from "zod";

const id = z.number().int().positive();

export const routingConfigSchema = z
  .object({
    platformId: id,
    mode: z.enum(["MANUAL", "AUTO", "BY_CITY"]),
    primaryCompanyId: id.nullable().optional(),
    fallbackCompanyId: id.nullable().optional(),
  })
  .superRefine((d, ctx) => {
    const p = d.primaryCompanyId ?? null;
    const f = d.fallbackCompanyId ?? null;
    if (d.mode !== "MANUAL" && p === null) {
      ctx.addIssue({ code: "custom", message: "اختر الشركة الرئيسية لهذا النمط", path: ["primaryCompanyId"] });
    }
    if (f !== null && p === null) {
      ctx.addIssue({ code: "custom", message: "لا توجد شركة احتياطية بلا شركة رئيسية", path: ["fallbackCompanyId"] });
    }
    if (p !== null && f !== null && p === f) {
      ctx.addIssue({ code: "custom", message: "الشركة الرئيسية والاحتياطية يجب أن تكونا مختلفتين", path: ["fallbackCompanyId"] });
    }
  });

export const coverageSetSchema = z.object({
  companyId: id,
  cityIds: z.array(id).max(300, "عدد المدن كبير"),
});

export type RoutingConfigInput = z.infer<typeof routingConfigSchema>;
export type CoverageSetInput = z.infer<typeof coverageSetSchema>;
