import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { addressUpdateSchema } from "@/lib/validations/address";

async function requireAuth() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  return { user: current.user };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const addressId = parseInt(id);
    if (isNaN(addressId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const address = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId: auth.user.id,
        deletedAt: null,
      },
      include: {
        cityRef: { select: { id: true, name: true } },
        districtRef: { select: { id: true, name: true } },
      },
    });

    if (!address) {
      return NextResponse.json(
        { success: false, message: "العنوان غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, address });
  } catch (error) {
    console.error("Address get error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const addressId = parseInt(id);
    if (isNaN(addressId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = addressUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId: auth.user.id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "العنوان غير موجود" },
        { status: 404 }
      );
    }

    const data = parsed.data;

    // ═══ التحقق من المدينة/الحي إن تغيّرا ═══
    let cityName: string | null = null;
    let districtName: string | null = null;

    const newCityId = data.cityId ?? existing.cityId;
    const newDistrictId =
      data.districtId !== undefined ? data.districtId : existing.districtId;

    if (newCityId) {
      const city = await prisma.city.findUnique({
        where: { id: newCityId },
        select: { name: true },
      });
      if (!city) {
        return NextResponse.json(
          { success: false, message: "المدينة غير موجودة" },
          { status: 400 }
        );
      }
      cityName = city.name;
    }

    if (newDistrictId) {
      const district = await prisma.district.findUnique({
        where: { id: newDistrictId },
        select: { name: true, cityId: true },
      });
      if (!district || district.cityId !== newCityId) {
        return NextResponse.json(
          { success: false, message: "الحي لا ينتمي لهذه المدينة" },
          { status: 400 }
        );
      }
      districtName = district.name;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // ═══ إذا صار default → ألغِ الآخرين ═══
      if (data.isDefault === true) {
        await tx.address.updateMany({
          where: {
            userId: auth.user.id,
            isDefault: true,
            id: { not: addressId },
            deletedAt: null,
          },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id: addressId },
        data: {
          ...(data.fullName !== undefined && { fullName: data.fullName }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.cityId !== undefined && { cityId: data.cityId }),
          ...(data.districtId !== undefined && {
            districtId: data.districtId,
          }),
          ...(cityName && { city: cityName }),
          ...(districtName !== null && { district: districtName }),
          ...(data.street !== undefined && { street: data.street }),
          ...(data.buildingNumber !== undefined && {
            buildingNumber: data.buildingNumber,
          }),
          ...(data.apartment !== undefined && {
            apartment: data.apartment,
          }),
          ...(data.landmark !== undefined && { landmark: data.landmark }),
          ...(data.postalCode !== undefined && {
            postalCode: data.postalCode,
          }),
          ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        },
        include: {
          cityRef: { select: { id: true, name: true } },
          districtRef: { select: { id: true, name: true } },
        },
      });
    });

    return NextResponse.json({ success: true, address: updated });
  } catch (error) {
    console.error("Address update error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const addressId = parseInt(id);
    if (isNaN(addressId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId: auth.user.id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "العنوان غير موجود" },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // ═══ Soft Delete ═══
      await tx.address.update({
        where: { id: addressId },
        data: { deletedAt: new Date(), isDefault: false },
      });

      // ═══ إذا كان default → عيّن بديل ═══
      if (existing.isDefault) {
        const next = await tx.address.findFirst({
          where: {
            userId: auth.user.id,
            deletedAt: null,
            id: { not: addressId },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        if (next) {
          await tx.address.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Address delete error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}