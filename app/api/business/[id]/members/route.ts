import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { businessMemberInviteSchema } from "@/lib/business-validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const { id } = await params;
    const businessId = parseInt(id);
    if (isNaN(businessId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      include: { members: { where: { userId: current.user.id, deletedAt: null } } },
    });
    if (!biz || biz.deletedAt) {
      return NextResponse.json({ success: false, message: "النشاط غير موجود" }, { status: 404 });
    }
    const isOwner = biz.ownerUserId === current.user.id;
    const isMember = biz.members.length > 0;
    if (!isOwner && !isMember) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const members = await prisma.businessMember.findMany({
      where: { businessId, deletedAt: null },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ success: true, members });
  } catch (error) {
    console.error("Business members GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const { id } = await params;
    const businessId = parseInt(id);
    if (isNaN(businessId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerUserId: true, deletedAt: true },
    });
    if (!biz || biz.deletedAt) {
      return NextResponse.json({ success: false, message: "النشاط غير موجود" }, { status: 404 });
    }
    if (biz.ownerUserId !== current.user.id) {
      return NextResponse.json({ success: false, message: "المالك فقط يمكنه دعوة أعضاء" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = businessMemberInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }
    const targetUser = await prisma.user.findFirst({
      where: { email: parsed.data.email, deletedAt: null },
      select: { id: true, email: true, name: true },
    });
    if (!targetUser) {
      return NextResponse.json(
        { success: false, message: "لا يوجد مستخدم بهذا البريد" },
        { status: 404 }
      );
    }
    if (targetUser.id === biz.ownerUserId) {
      return NextResponse.json({ success: false, message: "المالك عضو تلقائيًا" }, { status: 400 });
    }
    const existing = await prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId: targetUser.id } },
    });
    if (existing && !existing.deletedAt) {
      return NextResponse.json({ success: false, message: "العضو موجود مسبقًا" }, { status: 400 });
    }
    const member = existing
      ? await prisma.businessMember.update({
          where: { id: existing.id },
          data: {
            role: parsed.data.role,
            permissions: parsed.data.permissions ?? undefined,
            deletedAt: null,
          },
          include: { user: { select: { id: true, name: true, email: true } } },
        })
      : await prisma.businessMember.create({
          data: {
            businessId,
            userId: targetUser.id,
            role: parsed.data.role,
            permissions: parsed.data.permissions ?? undefined,
          },
          include: { user: { select: { id: true, name: true, email: true } } },
        });
    return NextResponse.json({ success: true, member }, { status: 201 });
  } catch (error) {
    console.error("Business members POST error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}