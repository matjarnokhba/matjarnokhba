import { NextResponse } from "next/server";
import { z } from "zod";
import { SessionService } from "@/services/session.service";
import { IdempotencyService } from "@/lib/idempotency";
import { isWholesaleError, toHttpResponse } from "@/lib/wholesale/errors";

// ═══ Response builders ═══
export function ok(data: Record<string, any> = {}, status = 200): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status });
}

export function fail(
  message: string,
  status = 400,
  extra: Record<string, any> = {}
): NextResponse {
  return NextResponse.json({ success: false, message, ...extra }, { status });
}

// ═══ Auth helpers ═══
type CurrentUser = NonNullable<Awaited<ReturnType<typeof SessionService.getCurrent>>>;

export async function requireAuth(): Promise<
  { ok: true; current: CurrentUser } | { ok: false; response: NextResponse }
> {
  const current = await SessionService.getCurrent();
  if (!current) {
    return { ok: false, response: fail("يجب تسجيل الدخول", 401) };
  }
  return { ok: true, current };
}

export async function requireAdmin(): Promise<
  { ok: true; current: CurrentUser } | { ok: false; response: NextResponse }
> {
  const current = await SessionService.getCurrent();
  if (!current) {
    return { ok: false, response: fail("يجب تسجيل الدخول", 401) };
  }
  if (
    current.user.role !== "ADMIN" &&
    current.user.role !== "SUPER_ADMIN"
  ) {
    return { ok: false, response: fail("غير مصرح — للأدمن فقط", 403) };
  }
  return { ok: true, current };
}

// ═══ JSON + Zod body parser ═══
export async function parseJson<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<
  { ok: true; data: T } | { ok: false; response: NextResponse }
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: fail("JSON غير صالح", 400) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      response: fail(first?.message ?? "بيانات غير صحيحة", 400, {
        issues: parsed.error.issues,
      }),
    };
  }
  return { ok: true, data: parsed.data };
}

// ═══ Unified error handler ═══
export function handleError(err: unknown, label?: string): NextResponse {
  if (label) console.error(`[${label}]`, err);
  else console.error("[API]", err);
  const { status, body } = toHttpResponse(err);
  return NextResponse.json(body, { status });
}

// ═══ Idempotency wrapper ═══
export async function withIdempotency(
  request: Request,
  userId: number,
  endpoint: string,
  body: unknown,
  handler: () => Promise<{ data: Record<string, any>; status?: number }>
): Promise<NextResponse> {
  const key = request.headers.get("Idempotency-Key");
  if (!key || key.length < 8) {
    return fail("Idempotency-Key مطلوب (8 أحرف على الأقل)", 400);
  }

  const idem = await IdempotencyService.check(userId, endpoint, key, body);
  if (idem.status === "cached") {
    return NextResponse.json(idem.response, { status: idem.statusCode });
  }
  if (idem.status === "conflict") return fail(idem.message, 409);
  if (idem.status === "in_progress") return fail(idem.message, 429);

  try {
    const { data, status = 200 } = await handler();
    const payload = { success: true, ...data };
    await IdempotencyService.save(idem.id, payload, status);
    return NextResponse.json(payload, { status });
  } catch (err) {
    await IdempotencyService.clear(idem.id);
    throw err;
  }
}

// ═══ Extract URL param helper ═══
export function numericParam(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n <= 0) return null;
  return n;
}