import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  displayName: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  entityType: z.enum(["COMPANY", "FACTORY", "SUPPLIER"]),
});

const entityToActivity: Record<string, "COMPANY" | "FACTORY" | "DISTRIBUTOR"> = {
  COMPANY: "COMPANY",
  FACTORY: "FACTORY",
  SUPPLIER: "DISTRIBUTOR",
};

function slugify(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[^\w\s\u0600-\u06FF-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60) || "supplier";
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let i = 1;
  while (await prisma.wholesaleSupplier.findUnique({ where: { slug } })) {
    slug = `${base}-${i++}`;
    if (i > 100) throw new Error("تعذر إنشاء رابط فريد");
  }
  return slug;
}

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }
    if (!current.user.seller) {
      return NextResponse.json({ success: false, message: "يجب أن تملك متجرًا أولًا" }, { status: 403 });
    }

    const existing = await prisma.wholesaleSupplier.findUnique({
      where: { userId: current.user.id },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ success: false, message: "أنت منضم بالفعل لسوق الجملة" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const supplier = await prisma.wholesaleSupplier.create({
      data: {
        userId: current.user.id,
        displayName: parsed.data.displayName,
        slug: await uniqueSlug(slugify(parsed.data.displayName)),
        city: parsed.data.city,
        entityType: parsed.data.entityType,
        activityType: entityToActivity[parsed.data.entityType],
        status: "PENDING",
        isVerified: false,
      },
      select: { id: true, slug: true, status: true, entityType: true },
    });

    return NextResponse.json({ success: true, supplier });
  } catch (error) {
    console.error("Join wholesale error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}