import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  type: z
    .enum(["COMPANY", "WORKSHOP", "FACTORY", "WAREHOUSE", "SHOP", "DISTRIBUTOR"])
    .optional(),
  city: z.string().trim().min(2).max(80).optional(),
  address: z.string().trim().max(300).nullable().optional(),
  isActive: z.boolean().optional(),
});

async function requireOwnSource(sourceId: number) {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const supplier = await prisma.wholesaleSupplier.findUnique({
    where: { userId: current.user.id },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!supplier || supplier.deletedAt) {
    return { error: "ليس لديك حساب جملة", status: 403 };
  }

  const source = await prisma.wholesaleSource.findUnique({
    where: { id: sourceId },
    include: { _count: { select: { products: true } } },
  });
  if (!source || source.supplierId !== supplier.id) {
    return { error: "المصدر غير موجود", status: 404 };
  }

  return { user: current.user, supplier, source };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sourceId = parseInt(id);
    if (isNaN(sourceId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const auth = await requireOwnSource(sourceId);
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name.trim();
    if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
    if (parsed.data.city !== undefined) updateData.city = parsed.data.city.trim();
    if (parsed.data.address !== undefined)
      updateData.address = parsed.data.address?.trim() || null;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, message: "لا يوجد تغيير" },
        { status: 400 }
      );
    }

    const updated = await prisma.wholesaleSource.update({
      where: { id: sourceId },
      data: updateData,
    });

    return NextResponse.json({ success: true, source: updated });
  } catch (error) {
    console.error("Source PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sourceId = parseInt(id);
    if (isNaN(sourceId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const auth = await requireOwnSource(sourceId);
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    if (auth.source._count.products > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن حذف المصدر لأنه مرتبط بـ ${auth.source._count.products} منتج. انقل المنتجات لمصدر آخر أولًا.`,
        },
        { status: 400 }
      );
    }

    await prisma.wholesaleSource.delete({ where: { id: sourceId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Source DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}