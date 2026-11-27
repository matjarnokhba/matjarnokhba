import { z } from "zod";

const method = z.enum(["GET", "POST", "PUT", "PATCH"]);
const apiPath = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^\/[A-Za-z0-9_\-./{}]*$/, "مسار غير صالح")
  .refine((p) => !p.includes("//") && !p.includes(".."), "مسار غير صالح");
const jsonPath = z.string().trim().max(100).regex(/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/, "مسار حقل غير صالح");
const headerName = z.string().trim().regex(/^[A-Za-z0-9-]{1,50}$/, "اسم ترويسة غير صالح");
const okStatuses = z.array(z.number().int().min(200).max(299)).min(1).max(5);
const SENSITIVE_HEADER = /authori|key|token|secret|cookie|signature/i;

const headers = z
  .record(headerName, z.string().max(300))
  .refine((h) => Object.keys(h).length <= 10, "حتى 10 ترويسات")
  .refine(
    (h) => Object.entries(h).every(([k, v]) => !SENSITIVE_HEADER.test(k) || /^\{\{\s*cred\.[A-Za-z0-9_]+\s*\}\}$/.test(v)),
    "الترويسة الحساسة يجب أن تأخذ قيمتها من {{cred.اسم}} ولا تُكتب نصاً"
  );

const jsonObject = z.record(z.string().max(60), z.unknown()).refine((o) => JSON.stringify(o).length <= 5000, "القالب كبير جداً");

export const httpConfigSchema = z.strictObject({
  version: z.literal(1),
  timeoutMs: z.number().int().min(1000).max(25000).default(10000),
  headers: headers.optional(),
  authHeaderName: headerName.optional(),
  authQueryName: z.string().regex(/^[A-Za-z0-9_]{1,40}$/).optional(),
  test: z.strictObject({ method, path: apiPath, successStatus: okStatuses.optional() }).optional(),
  create: z
    .strictObject({
      method,
      path: apiPath,
      bodyTemplate: jsonObject,
      idempotencyHeader: headerName.optional(),
      successStatus: okStatuses.optional(),
      externalIdPath: jsonPath.optional(),
      trackingPath: jsonPath.optional(),
      testPath: apiPath.optional(),
      testBodyExtra: jsonObject.optional(),
    })
    .optional(),
  tracking: z.strictObject({ method: z.enum(["GET", "POST"]), path: apiPath, statusPath: jsonPath, timePath: jsonPath.optional() }).optional(),
  webhook: z
    .strictObject({
      signatureHeader: headerName.optional(),
      timestampHeader: headerName.optional(),
      eventsPath: jsonPath.optional(),
      eventIdPath: jsonPath.optional(),
      externalIdPath: jsonPath.optional(),
      trackingPath: jsonPath.optional(),
      statusPath: jsonPath.optional(),
      timePath: jsonPath.optional(),
    })
    .optional(),
});

export type HttpConfig = z.infer<typeof httpConfigSchema>;

const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function getPath(obj: unknown, path: string): unknown {
  let cur: any = obj; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const k of path.split(".")) {
    if (BAD_KEYS.has(k) || cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = Array.isArray(cur) ? cur[Number(k)] : cur[k];
  }
  return cur;
}

const PH = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

/** يملأ القوالب؛ نص كامل = {{x}} يحتفظ بنوع القيمة (رقم/منطقي). */
export function renderTemplate(v: unknown, ctx: Record<string, unknown>, depth = 0): unknown {
  if (depth > 8) return null;
  if (typeof v === "string") {
    const whole = v.match(/^\{\{\s*([A-Za-z0-9_.]+)\s*\}\}$/);
    if (whole) return getPath(ctx, whole[1]) ?? null;
    return v.replace(PH, (_m, p: string) => {
      const x = getPath(ctx, p);
      return x === null || x === undefined ? "" : String(x);
    });
  }
  if (Array.isArray(v)) return v.map((x) => renderTemplate(x, ctx, depth + 1));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, renderTemplate(x, ctx, depth + 1)]));
  return v;
}

/** مسار الطلب: القيم تُرمَّز لمنع حقن مسارات. */
export function renderPath(p: string, ctx: Record<string, unknown>): string {
  return p.replace(PH, (_m, k: string) => encodeURIComponent(String(getPath(ctx, k) ?? "")));
}