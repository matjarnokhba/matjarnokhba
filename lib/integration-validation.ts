import { z } from "zod";
import { CAPABILITIES } from "@/lib/courier-adapter";
import { CANONICAL_STATUSES } from "@/lib/integration-status";
import { isSafeUrlSyntax } from "@/lib/integration-ssrf";
import { httpConfigSchema } from "@/lib/integration-config";

const httpsUrl = z.string().trim().url("رابط غير صحيح").max(300).refine((u) => u.startsWith("https://"), "الرابط يجب أن يبدأ بـ https://").refine((u) => isSafeUrlSyntax(u), "عنوان غير مسموح (داخلي أو IP مباشر أو يحتوي بيانات دخول)");
const capabilities = z.array(z.enum(CAPABILITIES)).max(CAPABILITIES.length);
const authScheme = z.enum(["NONE", "BEARER", "API_KEY_HEADER", "BASIC", "QUERY_KEY"]);

export const providerCreateSchema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9-]{3,30}$/, "الكود: أحرف إنجليزية وأرقام وشرطة (3-30)"),
  name: z.string().trim().min(2, "الاسم مطلوب").max(80),
  integrationType: z.enum(["API", "CSV", "MANUAL"]),
  baseUrl: httpsUrl.optional(),
  authScheme: authScheme.optional(),
  capabilities: capabilities.optional(),
  notes: z.string().trim().max(500).optional(),
});

export const providerActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    name: z.string().trim().min(2).max(80).optional(),
    baseUrl: httpsUrl.optional(),
    authScheme: authScheme.optional(),
    capabilities: capabilities.optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("set_credentials"),
    fields: z
      .record(z.string().min(1).max(60), z.string().min(1).max(2000))
      .refine((r) => Object.keys(r).length >= 1 && Object.keys(r).length <= 12, "من 1 إلى 12 حقلاً"),
  }),
  z.object({ action: z.literal("clear_credentials") }),
  z.object({ action: z.literal("test_connection") }),
  z.object({ action: z.literal("test_shipment") }),
  z.object({ action: z.literal("set_status"), status: z.enum(["TESTING", "ACTIVE", "DISABLED"]) }),
  z.object({ action: z.literal("rotate_webhook_secret") }),
  z.object({
    action: z.literal("set_mappings"),
    mappings: z
      .array(z.object({ externalStatus: z.string().trim().min(1).max(100), canonicalStatus: z.enum(CANONICAL_STATUSES) }))
      .min(1)
      .max(100),
  }),
  z.object({ action: z.literal("set_config"), config: httpConfigSchema }),
  z.object({ action: z.literal("apply_default_mappings") }),
]);

export const companyProviderSchema = z.object({ providerId: z.number().int().positive().nullable() });

export type ProviderCreateInput = z.infer<typeof providerCreateSchema>;
export type ProviderAction = z.infer<typeof providerActionSchema>;