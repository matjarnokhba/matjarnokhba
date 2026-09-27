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
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(100),
  image: z.string().trim().optional().nullable(),
  parentId: z.number().int().positive().optional().nullable(),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// ═══════ GET — قائمة التصنيفات ═══════
export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const categories = await prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: { order: "asc" },
      include: {
        _count: { select: { products: true } },
      },
    });

    return NextResponse.json({ success: true, categories });
  } catch (error) {
    console.error("Admin categories GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ POST — إنشاء تصنيف ═══════
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

    const cleanSlug = parsed.data.slug
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    if (!cleanSlug) {
      return NextResponse.json(
        { success: false, message: "slug غير صحيح" },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findUnique({
      where: { slug: cleanSlug },
    });

    if (existing && !existing.deletedAt) {
      return NextResponse.json(
        { success: false, message: "الرابط (slug) مستخدم" },
        { status: 400 }
      );
    }

    const category = await prisma.category.create({
      data: {
        name: parsed.data.name,
        slug: cleanSlug,
        image: parsed.data.image || null,
        parentId: parsed.data.parentId || null,
        order: parsed.data.order,
        isActive: parsed.data.isActive,
      },
    });

    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (error) {
    console.error("Admin category POST error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}