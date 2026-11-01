import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { WholesaleOfferService } from "@/services/wholesale-offer.service";

const schema = z.object({
  action: z.enum(["activate", "pause", "close"]),
});

async function checkBusinessAccess(businessId: number, userId: number) {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    include: { members: { where: { userId, deletedAt: null } } },
  });
  if (!biz || biz.deletedAt) return { error: "النشاط غير موجود", status: 404 } as const;
  const isOwner = biz.ownerUserId === userId;
  const member = biz.members[0] || null;
  if (!isOwner && !member) return { error: "غير مصرح", status: 403 } as const;
  const canWrite = isOwner || (member && ["MANAGER", "SALES"].includes(member.role));
  return { biz, canWrite } as const;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; offerId: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const { id, offerId } = await params;
    const businessId = parseInt(id);
    const oid = parseInt(offerId);
    if (isNaN(businessId) || isNaN(oid)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }
    const access = await checkBusinessAccess(businessId, current.user.id);
    if ("error" in access) {
      return NextResponse.json({ success: false, message: access.error }, { status: access.status });
    }
    if (!access.canWrite) {
      return NextResponse.json({ success: false, message: "لا تملك صلاحية" }, { status: 403 });
    }
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }
    const offer = await WholesaleOfferService.updateOfferStatus(oid, businessId, parsed.data.action);
    return NextResponse.json({ success: true, offer });
  } catch (error) {
    console.error("Offer status error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}