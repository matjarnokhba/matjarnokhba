import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { addressCreateSchema } from "@/lib/validations/address";

async function requireAuth() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  return { user: current.user };
}

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
      include: {
        cityRef: { select: { id: true, name: true, nameFr: true } },
        districtRef: { select: { id: true, name: true } },
      },
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
    const parsed = addressCreateSchema.safeParse(body);
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

    // ═══ تحقق: المدينة موجودة ═══
    const city = await prisma.city.findUnique({
      where: { id: data.cityId },
      select: { id: true, name: true },
    });
    if (!city) {
      return NextResponse.json(
        { success: false, message: "المدينة غير موجودة" },
        { status: 400 }
      );
    }

    // ═══ تحقق: الحي موجود وينتمي للمدينة ═══
    if (data.districtId) {
      const district = await prisma.district.findUnique({
        where: { id: data.districtId },
        select: { id: true, cityId: true, name: true },
      });
      if (!district || district.cityId !== data.cityId) {
        return NextResponse.json(
          { success: false, message: "الحي لا ينتمي لهذه المدينة" },
          { status: 400 }
        );
      }
    }

    // ═══ الحد الأقصى 10 عناوين ═══
    const count = await prisma.address.count({
      where: { userId: auth.user.id, deletedAt: null },
    });
    if (count >= 10) {
      return NextResponse.json(
        {
          success: false,
          message: "لا يمكن حفظ أكثر من 10 عناوين",
        },
        { status: 400 }
      );
    }

    const districtName = data.districtId
      ? (
          await prisma.district.findUnique({
            where: { id: data.districtId },
            select: { name: true },
          })
        )?.name || null
      : null;

    const address = await prisma.$transaction(async (tx) => {
      // ═══ إذا isDefault → إلغاء الافتراضي القديم ═══
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

      // ═══ إذا أول عنوان → اجعله افتراضي ═══
      const shouldBeDefault = data.isDefault || count === 0;

      return tx.address.create({
        data: {
          userId: auth.user.id,
          fullName: data.fullName,
          phone: data.phone,
          country: "MA",
          cityId: data.cityId,
          districtId: data.districtId || null,
          city: city.name,
          district: districtName,
          street: data.street,
          buildingNumber: data.buildingNumber || null,
          apartment: data.apartment || null,
          landmark: data.landmark || null,
          postalCode: data.postalCode || null,
          isDefault: shouldBeDefault,
        },
        include: {
          cityRef: { select: { id: true, name: true } },
          districtRef: { select: { id: true, name: true } },
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