import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

const createSchema = z.object({
  code: z.string().trim().min(2).max(30),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.number().positive(),
  minOrderAmount: z.number().min(0).optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
  maxUsesPerUser: z.number().int().positive().default(1),
  startDate: z.string(),
  endDate: z.string(),
  isActive: z.boolean().default(true),
});

// ═══════ GET — قائمة الكوبونات ═══════
export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const coupons = await prisma.coupon.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { usages: true } } },
    });

    return NextResponse.json({ success: true, coupons });
  } catch (error) {
    console.error("Admin coupons GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ POST — إنشاء كوبون ═══════
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();

    // تحقق من PERCENTAGE (1-100)
    if (body.type === "PERCENTAGE" && (body.value < 1 || body.value > 100)) {
      return NextResponse.json(
        { success: false, message: "النسبة يجب أن تكون من 1 إلى 100" },
        { status: 400 }
      );
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const cleanCode = parsed.data.code.toUpperCase();

    const existing = await prisma.coupon.findFirst({
      where: { code: cleanCode, deletedAt: null },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "الكود مستخدم بالفعل" },
        { status: 400 }
      );
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: cleanCode,
        type: parsed.data.type,
        value: parsed.data.value,
        minOrderAmount: parsed.data.minOrderAmount ?? null,
        maxUses: parsed.data.maxUses ?? null,
        maxUsesPerUser: parsed.data.maxUsesPerUser,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        isActive: parsed.data.isActive,
      },
    });

    return NextResponse.json({ success: true, coupon }, { status: 201 });
  } catch (error) {
    console.error("Admin coupon POST error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}