import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  storeName: z.string().trim().min(2, "اسم المتجر يجب أن يكون حرفين على الأقل").max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "الرابط يجب أن يحتوي حروفاً إنجليزية صغيرة وأرقاماً وشرطات فقط"),
  description: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  region: z.string().trim().max(80).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    // ═══ إذا عنده Seller بالفعل ═══
    if (current.user.seller) {
      return NextResponse.json(
        { success: false, message: "لديك متجر بالفعل" },
        { status: 400 }
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

    const cleanSlug = parsed.data.slug.toLowerCase().trim();

    // ═══ تحقق من slug مكرر ═══
    const existing = await prisma.seller.findUnique({
      where: { slug: cleanSlug },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "الرابط (slug) مستخدم — اختر رابطاً آخر" },
        { status: 400 }
      );
    }

    // ═══ إنشاء Seller + ترقية الدور ═══
    const seller = await prisma.$transaction(async (tx) => {
      const newSeller = await tx.seller.create({
        data: {
          userId: current.user.id,
          storeName: parsed.data.storeName.trim(),
          slug: cleanSlug,
          description: parsed.data.description?.trim() || null,
          city: parsed.data.city?.trim() || null,
          region: parsed.data.region?.trim() || null,
          status: "PENDING", // ⚠️ بانتظار موافقة الأدمن
        },
      });

      // ترقية المستخدم إلى SELLER (فقط إذا كان CUSTOMER)
      if (current.user.role === "CUSTOMER") {
        await tx.user.update({
          where: { id: current.user.id },
          data: { role: "SELLER" },
        });
      }

      return newSeller;
    });

    return NextResponse.json({
      success: true,
      seller: {
        id: seller.id,
        storeName: seller.storeName,
        slug: seller.slug,
        status: seller.status,
      },
    });
  } catch (error) {
    console.error("Seller onboarding error:", error);
    const message = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}