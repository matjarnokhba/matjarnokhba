import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { productMasterCreateSchema } from "@/lib/product-master-validation";
import { ProductMasterService } from "@/services/product-master.service";
import { isWholesaleTrader } from "@/lib/business-type-guards";

async function requireBusinessAccess(businessId: number, userId: number) {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    include: { members: { where: { userId, deletedAt: null } } },
  });
  if (!biz || biz.deletedAt) return { error: "النشاط غير موجود", status: 404 } as const;
  const isOwner = biz.ownerUserId === userId;
  const member = biz.members[0] || null;
  if (!isOwner && !member) return { error: "غير مصرح", status: 403 } as const;
  if (biz.status !== "VERIFIED") return { error: "النشاط غير موثق", status: 403 } as const;
  const canWrite = isOwner || (member && ["MANAGER"].includes(member.role));
  return { biz, canWrite } as const;
}

export async function GET(
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
    const access = await requireBusinessAccess(businessId, current.user.id);
    if ("error" in access) {
      return NextResponse.json({ success: false, message: access.error }, { status: access.status });
    }
    const url = new URL(request.url);
    const result = await ProductMasterService.listMasters({
      businessId,
      page: parseInt(url.searchParams.get("page") || "1"),
      pageSize: parseInt(url.searchParams.get("pageSize") || "30"),
      search: url.searchParams.get("search") || undefined,
      categoryId: url.searchParams.get("categoryId") ? parseInt(url.searchParams.get("categoryId")!) : undefined,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Masters GET error:", error);
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
    const access = await requireBusinessAccess(businessId, current.user.id);
    if ("error" in access) {
      return NextResponse.json({ success: false, message: access.error }, { status: access.status });
    }
    if (!access.canWrite) {
      return NextResponse.json({ success: false, message: "لا تملك صلاحية إدارة المنتجات" }, { status: 403 });
    }

    if (await isWholesaleTrader(businessId)) {
      return NextResponse.json(
        { success: false, message: "حسابات تجار الجملة لا تنشئ منتجات جديدة" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = productMasterCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const master = await ProductMasterService.createMaster(businessId, current.user.id, parsed.data);
    return NextResponse.json({ success: true, master }, { status: 201 });
  } catch (error) {
    console.error("Masters POST error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}