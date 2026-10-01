import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { rateLimit, getClientIp, formatRetryAfter } from "@/lib/rate-limit";

// ═══════ Schema ═══════
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "الاسم يجب أن يكون حرفين على الأقل")
    .max(100),
  email: z.string().trim().email("بريد إلكتروني غير صحيح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  storeName: z
    .string()
    .trim()
    .min(2, "اسم المتجر يجب أن يكون حرفين على الأقل")
    .max(80),
  slug: z
    .string()
    .trim()
    .min(2, "الرابط قصير جداً")
    .max(80, "الرابط طويل جداً")
    .regex(
      /^[a-z0-9-]+$/,
      "الرابط يجب أن يحتوي حروفاً إنجليزية صغيرة وأرقاماً وشرطات فقط"
    ),
  city: z.string().trim().max(80).optional().nullable(),
  region: z.string().trim().max(80).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    // ═══ Rate Limit ═══
    const ip = getClientIp(request);
    const limit = rateLimit(`seller-register:${ip}`, 3, 60 * 60 * 1000);
    if (!limit.success) {
      return NextResponse.json(
        {
          success: false,
          message: `محاولات كثيرة. حاول بعد ${formatRetryAfter(limit.retryAfterMs)}.`,
        },
        { status: 429 }
      );
    }

    // ═══ التحقق ═══
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

    const { name, email, password, storeName, slug, city, region } =
      parsed.data;

    const cleanEmail = email.toLowerCase().trim();
    const cleanSlug = slug.toLowerCase().trim();

    // ═══ تحقق: البريد مستخدم؟ ═══
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });
    if (existingUser && !existingUser.deletedAt) {
      return NextResponse.json(
        { success: false, message: "البريد الإلكتروني مستخدم بالفعل" },
        { status: 400 }
      );
    }

    // ═══ تحقق: slug مستخدم؟ ═══
    const existingSlug = await prisma.seller.findUnique({
      where: { slug: cleanSlug },
    });
    if (existingSlug) {
      return NextResponse.json(
        { success: false, message: "رابط المتجر مستخدم — اختر رابطاً آخر" },
        { status: 400 }
      );
    }

    // ═══ تشفير كلمة المرور ═══
    const passwordHash = await bcrypt.hash(password, 12);

    // ═══ إنشاء User + Seller في transaction ═══
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: cleanEmail,
          passwordHash,
          role: "SELLER",
        },
      });

      const seller = await tx.seller.create({
        data: {
          userId: user.id,
          storeName: storeName.trim(),
          slug: cleanSlug,
          city: city?.trim() || null,
          region: region?.trim() || null,
          status: "PENDING",
        },
      });

      return { user, seller };
    });

    // ═══ إشعار للأدمن ═══
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "SUPER_ADMIN"] },
        deletedAt: null,
      },
      select: { id: true },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: "SELLER_NEW_REGISTRATION",
          title: "🏪 تاجر جديد سجّل",
          message: `"${storeName.trim()}" (${name.trim()}) سجّل كتاجر جديد — بانتظار المراجعة.`,
          link: `/admin/sellers/${result.seller.id}`,
          category: "SELLER",
          severity: "INFO",
          metadata: {
            sellerId: result.seller.id,
            storeName: storeName.trim(),
            userName: name.trim(),
            userEmail: cleanEmail,
            city: city?.trim() || null,
            region: region?.trim() || null,
          },
        },
      });
    }

    // ═══ إنشاء الجلسة تلقائياً ═══
    const userAgent = request.headers.get("user-agent") || undefined;
    await SessionService.create(result.user.id, userAgent);

    return NextResponse.json(
      {
        success: true,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
        seller: {
          id: result.seller.id,
          storeName: result.seller.storeName,
          slug: result.seller.slug,
          status: result.seller.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Seller register error:", error);
    const message = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}