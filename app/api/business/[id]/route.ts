import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { businessUpdateSchema } from "@/lib/business-validation";

async function requireAccess(businessId: number) {
  const current = await SessionService.getCurrent();
  if (!current) {
    return { error: "يجب تسجيل الدخول", status: 401 } as const;
  }
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    include: { members: { where: { userId: current.user.id, deletedAt: null } } },
  });
  if (!biz || biz.deletedAt) {
    return { error: "النشاط غير موجود", status: 404 } as const;
  }
  const isOwner = biz.ownerUserId === current.user.id;
  const isMember = biz.members.length > 0;
  if (!isOwner && !isMember) {
    return { error: "غير مصرح", status: 403 } as const;
  }
  return { user: current.user, biz, isOwner } as const;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const businessId = parseInt(id);
    if (isNaN(businessId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }
    const access = await requireAccess(businessId);
    if ("error" in access) {
      return NextResponse.json({ success: false, message: access.error }, { status: access.status });
    }
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        members: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        documents: { orderBy: { createdAt: "desc" } },
        _count: { select: { productMasters: true, wholesaleOffers: true } },
      },
    });
    return NextResponse.json({ success: true, business });
  } catch (error) {
    console.error("Business GET id error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const businessId = parseInt(id);
    if (isNaN(businessId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }
    const access = await requireAccess(businessId);
    if ("error" in access) {
      return NextResponse.json({ success: false, message: access.error }, { status: access.status });
    }
    if (!access.isOwner) {
      return NextResponse.json({ success: false, message: "مالك النشاط فقط يمكنه التعديل" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = businessUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {};
    const allowed = [
      "name", "legalName", "description", "logo",
      "commercialRegister", "taxId", "city", "address", "phone", "email",
    ];
    for (const k of allowed) {
      if ((parsed.data as any)[k] !== undefined) updateData[k] = (parsed.data as any)[k];
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, message: "لا يوجد تغيير" }, { status: 400 });
    }

    const business = await prisma.business.update({
      where: { id: businessId },
      data: updateData,
    });
    return NextResponse.json({ success: true, business });
  } catch (error) {
    console.error("Business PATCH error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}