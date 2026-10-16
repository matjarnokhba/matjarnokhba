import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { moroccanPhoneSchema } from "@/lib/validations/address";

async function requireAuth() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  return { user: current.user };
}

// ═══ المدينة (من قائمة محلية) ═══
const citySchema = z.object({
  name: z.string().trim().min(1).max(100),
  nameFr: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100),
  region: z.string().trim().max(100).optional().default(""),
});

// ═══ الحي (نص حر + اختياري verified) ═══
const districtSchema = z.object({
  name: z.string().trim().min(1).max(100),
  placeId: z.string().trim().max(100).optional().nullable(),
  verified: z.boolean(),
});

const createSchema = z.object({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  phone: moroccanPhoneSchema,

  city: citySchema,
  district: districtSchema,

  fullAddressText: z.string().trim().min(3).max(300),

  buildingNumber: z.string().trim().max(50).optional().nullable(),
  landmark: z.string().trim().max(300).optional().nullable(),
  postalCode: z.string().trim().max(10).optional().nullable(),

  isDefault: z.boolean().optional().default(false),
});

export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const addresses = await prisma.address.findMany({
      where: { userId: auth.user.id, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, addresses });
  } catch (error) {
    console.error("Addresses list error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
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

    const data = parsed.data;

    // ═══ الحد الأقصى 10 عناوين ═══
    const count = await prisma.address.count({
      where: { userId: auth.user.id, deletedAt: null },
    });
    if (count >= 10) {
      return NextResponse.json(
        { success: false, message: "لا يمكن حفظ أكثر من 10 عناوين" },
        { status: 400 }
      );
    }

    const fullName = `${data.firstName} ${data.lastName}`.trim();
    const cityText = data.city.name;
    const districtText = data.district.name;

    const address = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.address.updateMany({
          where: {
            userId: auth.user.id,
            isDefault: true,
            deletedAt: null,
          },
          data: { isDefault: false },
        });
      }

      const shouldBeDefault = data.isDefault || count === 0;

      return tx.address.create({
        data: {
          userId: auth.user.id,

          // الأسماء
          fullName,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          country: "MA",

          // المدينة
          city: cityText,
          cityText,
          citySlug: data.city.slug,
          cityPlaceId: null,

          // الحي
          district: districtText,
          districtText,
          districtPlaceId: data.district.verified
            ? data.district.placeId || null
            : null,
          districtPlaceIdUnverified: !data.district.verified
            ? data.district.name
            : null,

          // العنوان الحر
          street: data.fullAddressText,
          fullAddressText: data.fullAddressText,
          fullAddressPlaceId: null,

          // إحداثيات (فارغة — غير متوفرة من القائمة المحلية)
          latitude: null,
          longitude: null,

          // تفاصيل
          buildingNumber: data.buildingNumber || null,
          landmark: data.landmark || null,
          postalCode: data.postalCode || null,
          isDefault: shouldBeDefault,
        },
      });
    });

    return NextResponse.json({ success: true, address }, { status: 201 });
  } catch (error) {
    console.error("Address create error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}