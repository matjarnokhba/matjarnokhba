import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
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
    const offerId = parseInt(id);
    if (isNaN(offerId)) {
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

    const offer = await prisma.sellerOffer.findUnique({
      where: { id: offerId },
      select: { id: true, sellerUserId: true, claimVerified: true, claimType: true, deletedAt: true },
    });

    if (!offer || offer.deletedAt) {
      return NextResponse.json({ success: false, message: "العرض غير موجود" }, { status: 404 });
    }
    if (offer.claimVerified) {
      return NextResponse.json(
        { success: false, message: "تم التحقق من هذا العرض مسبقًا" },
        { status: 400 }
      );
    }

    if (parsed.data.action === "approve") {
      await prisma.sellerOffer.update({
        where: { id: offerId },
        data: { claimVerified: true },
      });
      return NextResponse.json({ success: true, action: "approved" });
    }

    await prisma.sellerOffer.update({
      where: { id: offerId },
      data: {
        isActive: false,
        claimNotes: parsed.data.reason
          ? `${offer.claimType}: ${parsed.data.reason}`
          : offer.claimType,
      },
    });
    return NextResponse.json({ success: true, action: "rejected" });
  } catch (error) {
    console.error("Admin claim verify error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}