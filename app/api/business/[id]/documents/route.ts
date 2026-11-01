import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { businessDocumentSchema } from "@/lib/business-validation";

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
    const documents = await prisma.businessDocument.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, documents });
  } catch (error) {
    console.error("Business documents GET error:", error);
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
      include: { members: { where: { userId: current.user.id, deletedAt: null } } },
    });
    if (!biz || biz.deletedAt) {
      return NextResponse.json({ success: false, message: "النشاط غير موجود" }, { status: 404 });
    }
    const isOwner = biz.ownerUserId === current.user.id;
    const isManager = biz.members.some((m: any) => m.role === "MANAGER");
    if (!isOwner && !isManager) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = businessDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }
    const doc = await prisma.businessDocument.create({
      data: {
        businessId,
        type: parsed.data.type,
        url: parsed.data.url,
        notes: parsed.data.notes ?? null,
      },
    });
    return NextResponse.json({ success: true, document: doc }, { status: 201 });
  } catch (error) {
    console.error("Business documents POST error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}