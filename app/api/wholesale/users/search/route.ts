import { z } from "zod";
import {
  requireAuth,
  handleError,
  ok,
  fail,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";

const querySchema = z.string().trim().min(3, "3 أحرف على الأقل").max(200);

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const parsed = querySchema.safeParse(q);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "بحث غير صالح", 400);
    }

    const query = parsed.data;
    const isEmail = query.includes("@");

    const where: any = { deletedAt: null };
    if (isEmail) {
      where.email = query.toLowerCase();
    } else {
      where.phone = query;
    }

    const user = await prisma.user.findFirst({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    if (!user) return ok({ user: null });
    return ok({ user });
  } catch (err) {
    return handleError(err, "GET /wholesale/users/search");
  }
}