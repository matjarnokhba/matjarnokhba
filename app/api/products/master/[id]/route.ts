import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireAuth() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "يجب تسجيل الدخول", status: 401 };
  const hasSeller = !!current.user.seller;
  const hasSupplier = !!current.user.wholesaleSupplier;
  if (!hasSeller && !hasSupplier) return { error: "غير مصرح", status: 403 };
  return { user: current.user };
}

export async function GET(
  _request: Request,
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
    const masterId = parseInt(id);
    if (isNaN(masterId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const master = await prisma.productMaster.findUnique({
      where: { id: masterId },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        manufacturer: { select: { id: true, name: true } },
        variants: {
          orderBy: { id: "asc" },
          select: { id: true, barcode: true, sku: true, options: true },
        },
        derivativesFrom: {
          select: {
            id: true,
            childMasterId: true,
            differences: true,
            createdAt: true,
            childMaster: { select: { id: true, name: true, slug: true } },
          },
        },
        offers: {
          where: { deletedAt: null },
          select: { id: true, isActive: true },
        },
      },
    });

    if (!master || master.deletedAt) {
      return NextResponse.json(
        { success: false, message: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      master: {
        id: master.id,
        name: master.name,
        slug: master.slug,
        brand: master.brand,
        description: master.description,
        images: master.images,
        barcode: master.barcode,
        qrCode: master.qrCode,
        specifications: master.specifications,
        category: master.category,
        manufacturer: master.manufacturer,
        isVerified: master.isVerified,
        status: master.status,
        variants: master.variants,
        derivatives: master.derivativesFrom.map((d) => ({
          id: d.id,
          childMasterId: d.childMasterId,
          childName: d.childMaster.name,
          childSlug: d.childMaster.slug,
          differences: d.differences,
          createdAt: d.createdAt,
        })),
        offersCount: master.offers.length,
        activeOffersCount: master.offers.filter((o) => o.isActive).length,
        isOwner: master.createdByUserId === auth.user.id,
      },
    });
  } catch (error) {
    console.error("Master detail error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

const patchSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  brand: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  images: z.array(z.string().url()).min(1).max(10).optional(),
  categoryId: z.number().int().positive().optional(),
  barcode: z.string().trim().min(3).max(100).nullable().optional(),
  qrCode: z.string().trim().min(3).max(200).nullable().optional(),
  specifications: z.record(z.string(), z.any()).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }

    const { id } = await params;
    const masterId = parseInt(id);
    if (isNaN(masterId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }

    const master = await prisma.productMaster.findUnique({
      where: { id: masterId },
      select: {
        id: true,
        createdByUserId: true,
        manufacturerUserId: true,
        barcode: true,
        qrCode: true,
        deletedAt: true,
      },
    });

    if (!master || master.deletedAt) {
      return NextResponse.json({ success: false, message: "المنتج غير موجود" }, { status: 404 });
    }

    // Only creator or manufacturer can edit
    const canEdit =
      master.createdByUserId === current.user.id ||
      master.manufacturerUserId === current.user.id;
    if (!canEdit) {
      return NextResponse.json(
        { success: false, message: "هذه الهوية لمنشئ آخر — لا يمكنك تعديلها. أنشئ نسخة مستقلة بدلًا من ذلك." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Barcode uniqueness
    if (data.barcode && data.barcode !== master.barcode) {
      const exists = await prisma.productMaster.findFirst({
        where: { barcode: data.barcode, deletedAt: null, id: { not: masterId } },
        select: { id: true, name: true },
      });
      if (exists) {
        return NextResponse.json(
          { success: false, message: `الباركود مستخدم للمنتج "${exists.name}"`, existingMasterId: exists.id },
          { status: 409 }
        );
      }
    }

    // QR uniqueness
    if (data.qrCode && data.qrCode !== master.qrCode) {
      const exists = await prisma.productMaster.findFirst({
        where: { qrCode: data.qrCode, deletedAt: null, id: { not: masterId } },
        select: { id: true },
      });
      if (exists) {
        return NextResponse.json(
          { success: false, message: "رمز QR مستخدم بالفعل", existingMasterId: exists.id },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.brand !== undefined) updateData.brand = data.brand?.trim() || null;
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.images !== undefined) updateData.images = data.images;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.barcode !== undefined) updateData.barcode = data.barcode?.trim() || null;
    if (data.qrCode !== undefined) updateData.qrCode = data.qrCode?.trim() || null;
    if (data.specifications !== undefined) updateData.specifications = data.specifications || undefined;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, message: "لا يوجد تغيير" }, { status: 400 });
    }

    const updated = await prisma.productMaster.update({
      where: { id: masterId },
      data: updateData,
      select: { id: true, name: true, slug: true, barcode: true },
    });

    return NextResponse.json({ success: true, master: updated });
  } catch (error) {
    console.error("Master PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء التعديل" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }

    const { id } = await params;
    const masterId = parseInt(id);
    if (isNaN(masterId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }

    const master = await prisma.productMaster.findUnique({
      where: { id: masterId },
      include: {
        _count: {
          select: {
            offers: { where: { isActive: true, deletedAt: null } },
          },
        },
      },
    });

    if (!master || master.deletedAt) {
      return NextResponse.json({ success: false, message: "المنتج غير موجود" }, { status: 404 });
    }

    const canDelete =
      master.createdByUserId === current.user.id ||
      master.manufacturerUserId === current.user.id;
    if (!canDelete) {
      return NextResponse.json(
        { success: false, message: "غير مصرح — هذه الهوية لمنشئ آخر" },
        { status: 403 }
      );
    }

    if (master._count.offers > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن حذف الهوية لوجود ${master._count.offers} عرض نشط مرتبط بها. عطّل العروض أولًا أو احذفها.`,
        },
        { status: 400 }
      );
    }

    await prisma.productMaster.update({
      where: { id: masterId },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Master DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء الحذف" },
      { status: 500 }
    );
  }
}