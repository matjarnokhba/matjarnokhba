import { z } from "zod";

export const JOB_ROLES = [
  "MANAGER",
  "RECEIVER",
  "SHIPMENT_PREPARER",
  "WORKER",
  "COLLECTOR",
  "TRANSFER_DRIVER",
  "DELIVERY_DRIVER",
  "RETURNS_HANDLER",
] as const;

export const JOB_ROLE_LABEL: Record<(typeof JOB_ROLES)[number], string> = {
  MANAGER: "مدير",
  RECEIVER: "موظف استقبال وتجميع",
  SHIPMENT_PREPARER: "موظف تجهيز الشحنات",
  WORKER: "عامل مستودع",
  COLLECTOR: "جامع من المتاجر",
  TRANSFER_DRIVER: "سائق بين المستودعات",
  DELIVERY_DRIVER: "سائق توصيل الزبائن",
  RETURNS_HANDLER: "مسؤول المرتجعات",
};

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{3,24}$/, "الرمز: 3 إلى 24 حرفاً لاتينياً كبيراً أو أرقاماً أو شرطة");

const name = z.string().trim().min(2, "الاسم قصير جداً").max(80, "الاسم طويل جداً");

export const warehouseCreateSchema = z
  .object({
    name,
    code: codeSchema.optional(),
    companyId: z.number().int().positive("الشركة مطلوبة"),
    city: z.string().trim().min(2, "المدينة مطلوبة").max(60),
    district: z.string().trim().max(60).optional(),
    address: z.string().trim().max(200).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    capacity: z.number().int().positive().optional(),
  })
  .refine((d) => (d.latitude === undefined) === (d.longitude === undefined), {
    message: "أدخل خط العرض وخط الطول معاً",
  });

export const warehouseUpdateSchema = z
  .object({
    name: name.optional(),
    city: z.string().trim().min(2).max(60).optional(),
    district: z.string().trim().max(60).nullable().optional(),
    address: z.string().trim().max(200).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    capacity: z.number().int().positive().nullable().optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "لا توجد تعديلات" });

export const companyCreateSchema = z.object({
  name,
  code: codeSchema.optional(),
  kind: z.enum(["INTERNAL", "EXTERNAL"]).default("INTERNAL"),
  headUserId: z.number().int().positive().optional(),
});

export const companyUpdateSchema = z
  .object({
    name: name.optional(),
    headUserId: z.number().int().positive().nullable().optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "DETACHING", "DETACHED"]).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "لا توجد تعديلات" });

export const membershipCreateSchema = z
  .object({
    userId: z.number().int().positive("المستخدم مطلوب"),
    scope: z.enum(["PLATFORM", "COMPANY", "WAREHOUSE"]),
    companyId: z.number().int().positive().optional(),
    warehouseId: z.number().int().positive().optional(),
    jobRoles: z.array(z.enum(JOB_ROLES)).max(8).default([]),
    notes: z.string().trim().max(300).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.scope === "WAREHOUSE") {
      if (!d.warehouseId) ctx.addIssue({ code: "custom", message: "المستودع مطلوب", path: ["warehouseId"] });
      if (d.jobRoles.length === 0) ctx.addIssue({ code: "custom", message: "اختر وظيفة واحدة على الأقل", path: ["jobRoles"] });
    }
    if (d.scope === "COMPANY" && !d.companyId) {
      ctx.addIssue({ code: "custom", message: "الشركة مطلوبة", path: ["companyId"] });
    }
    if (d.scope === "PLATFORM" && (d.companyId || d.warehouseId)) {
      ctx.addIssue({ code: "custom", message: "نطاق المنصة لا يقبل شركة أو مستودعاً", path: ["scope"] });
    }
  });

export const membershipUpdateSchema = z
  .object({
    status: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]).optional(),
    jobRoles: z.array(z.enum(JOB_ROLES)).max(8).optional(),
    notes: z.string().trim().max(300).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "لا توجد تعديلات" });

export type WarehouseCreateInput = z.infer<typeof warehouseCreateSchema>;
export type WarehouseUpdateInput = z.infer<typeof warehouseUpdateSchema>;
export type CompanyCreateInput = z.infer<typeof companyCreateSchema>;
export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;
export type MembershipCreateInput = z.infer<typeof membershipCreateSchema>;
export type MembershipUpdateInput = z.infer<typeof membershipUpdateSchema>;