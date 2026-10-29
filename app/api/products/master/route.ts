import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  name: z.string().trim().min(2).max(200),
  brand: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  images: z.array(z.string().url()).min(1).max(10),
  categoryId: z.number().int().positive(),
  barcode: z.string().trim().min(3).max(100).optional().nullable(),
  qrCode: z.string().trim().min(3).max(200).optional().nullable(),
  specifications: z.record(z.string(), z.any()).optional().nullable(),
  manufacturerUserId: z.number().int().positive().optional().nullable(),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\u0600-\u06FF-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80);
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base || "product";
  let counter = 1;
  while (await prisma.productMaster.findUnique({ where: { slug } })) {
    slug = `${base}-${counter}`;
    counter++;
    if (counter > 100) throw new Error("تعذر إنشاء رابط فريد");
  }
  return slug;
}

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    const supplier = current.user.wholesaleSupplier;
    if (!supplier || supplier.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "إنشاء هوية منتج متاح فقط لأصحاب الجملة الموثقين",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check barcode uniqueness
    if (data.barcode) {
      const existing = await prisma.productMaster.findFirst({
        where: { barcode: data.barcode, deletedAt: null },
        select: { id: true, name: true },
      });
      if (existing) {
        return NextResponse.json(
          {
            success: false,
            message: `الباركود مسجل بالفعل للمنتج "${existing.name}"`,
            existingMasterId: existing.id,
          },
          { status: 409 }
        );
      }
    }

    // Check QR uniqueness
    if (data.qrCode) {
      const existing = await prisma.productMaster.findFirst({
        where: { qrCode: data.qrCode, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          {
            success: false,
            message: "رمز QR مسجل بالفعل",
            existingMasterId: existing.id,
          },
          { status: 409 }
        );
      }
    }

    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId, deletedAt: null },
      select: { id: true, isLeaf: true },
    });
    if (!category) {
      return NextResponse.json(
        { success: false, message: "الفئة غير موجودة" },
        { status: 400 }
      );
    }

    // Manufacturer: if provided, verify user exists
    if (data.manufacturerUserId) {
      const mfg = await prisma.user.findUnique({
        where: { id: data.manufacturerUserId },
        select: { id: true },
      });
      if (!mfg) {
        return NextResponse.json(
          { success: false, message: "المصنع غير موجود" },
          { status: 400 }
        );
      }
    }

    const slug = await ensureUniqueSlug(slugify(data.name));

    // Auto-verify if supplier is verified (per decision S1=b)
    const isVerified = supplier.isVerified;

    const master = await prisma.productMaster.create({
      data: {
        name: data.name.trim(),
        slug,
        brand: data.brand?.trim() || null,
        description: data.description?.trim() || null,
        images: data.images,
        categoryId: data.categoryId,
        barcode: data.barcode?.trim() || null,
        qrCode: data.qrCode?.trim() || null,
        specifications: data.specifications || undefined,
        manufacturerUserId: data.manufacturerUserId || null,
        createdByUserId: current.user.id,
        isVerified,
        status: "ACTIVE",
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json(
      {
        success: true,
        master: {
          id: master.id,
          name: master.name,
          slug: master.slug,
          brand: master.brand,
          barcode: master.barcode,
          qrCode: master.qrCode,
          category: master.category,
          isVerified: master.isVerified,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Master create error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء إنشاء هوية المنتج" },
      { status: 500 }
    );
  }
}