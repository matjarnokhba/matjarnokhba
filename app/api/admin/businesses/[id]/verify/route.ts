import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { WholesaleNotifications } from "@/lib/wholesale-notifications";

const schema = z.object({
  approve: z.boolean(),
  reason: z.string().trim().max(500).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !["ADMIN", "SUPER_ADMIN"].includes(current.user.role)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const { id } = await params;
    const businessId = parseInt(id);
    if (isNaN(businessId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }
    const biz = await prisma.business.findUnique({ where: { id: businessId } });
    if (!biz || biz.deletedAt) {
      return NextResponse.json({ success: false, message: "النشاط غير موجود" }, { status: 404 });
    }
    if (biz.status === "VERIFIED" && parsed.data.approve) {
      return NextResponse.json({ success: false, message: "موثق مسبقًا" }, { status: 400 });
    }

    const updateData = parsed.data.approve
      ? { status: "VERIFIED" as const, verifiedAt: new Date(), verifiedById: current.user.id, rejectionReason: null }
      : { status: "REJECTED" as const, verifiedAt: null, verifiedById: current.user.id, rejectionReason: parsed.data.reason ?? "لم يتم تقديم سبب" };

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: updateData,
      select: { id: true, name: true, status: true, verifiedAt: true, rejectionReason: true },
    });

    if (parsed.data.approve) {
      WholesaleNotifications.businessVerified(biz.ownerUserId, {
        businessId: updated.id, businessName: updated.name,
      }).catch((e) => console.error("notify biz:", e));
    } else {
      WholesaleNotifications.businessRejected(biz.ownerUserId, {
        businessId: updated.id, businessName: updated.name, reason: parsed.data.reason,
      }).catch((e) => console.error("notify biz reject:", e));
    }

    return NextResponse.json({ success: true, business: updated });
  } catch (error) {
    console.error("Admin business verify error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}