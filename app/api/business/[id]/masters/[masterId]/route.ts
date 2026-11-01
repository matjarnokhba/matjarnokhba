import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { productMasterUpdateSchema } from "@/lib/product-master-validation";
import { ProductMasterService } from "@/services/product-master.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; masterId: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const { id, masterId } = await params;
    const businessId = parseInt(id);
    const mid = parseInt(masterId);
    if (isNaN(businessId) || isNaN(mid)) {
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
    const master = await ProductMasterService.getMaster(mid);
    if (!master || master.createdByBusinessId !== businessId) {
      return NextResponse.json({ success: false, message: "المنتج غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ success: true, master });
  } catch (error) {
    console.error("Master GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; masterId: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const { id, masterId } = await params;
    const businessId = parseInt(id);
    const mid = parseInt(masterId);
    if (isNaN(businessId) || isNaN(mid)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      include: { members: { where: { userId: current.user.id, deletedAt: null } } },
    });
    if (!biz || biz.deletedAt) {
      return NextResponse.json({ success: false, message: "النشاط غير موجود" }, { status: 404 });
    }
    if (biz.status !== "VERIFIED") {
      return NextResponse.json({ success: false, message: "النشاط غير موثق" }, { status: 403 });
    }
    const master = await prisma.productMaster.findUnique({
      where: { id: mid },
      select: { createdByBusinessId: true, deletedAt: true },
    });
    if (!master || master.deletedAt || master.createdByBusinessId !== businessId) {
      return NextResponse.json({ success: false, message: "المنتج غير موجود" }, { status: 404 });
    }
    const isOwner = biz.ownerUserId === current.user.id;
    const isManager = biz.members.some((m: any) => m.role === "MANAGER");
    if (!isOwner && !isManager) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = productMasterUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }
    const updated = await ProductMasterService.updateMaster(mid, parsed.data);
    return NextResponse.json({ success: true, master: updated });
  } catch (error) {
    console.error("Master PATCH error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}