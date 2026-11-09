import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; pkgId: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
    const { id, pkgId } = await params;
    const offerId = parseInt(id);
    const pid = parseInt(pkgId);
    if (isNaN(offerId) || isNaN(pid)) return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    const offer = await prisma.wholesaleOffer.findFirst({
      where: { id: offerId, deletedAt: null },
      select: {
        status: true,
        businessUnit: {
          select: {
            owner: { select: { userId: true } },
            members: { where: { userId: current.user.id, isActive: true, deletedAt: null }, select: { permissions: true } },
          },
        },
      },
    });
    if (!offer) return NextResponse.json({ success: false, message: "العرض غير موجود" }, { status: 404 });
    const isOwner = offer.businessUnit.owner.userId === current.user.id;
    const isManager = offer.businessUnit.members.some((m) => {
      const perms = m.permissions as string[] | null;
      return Array.isArray(perms) && perms.includes("offers.write");
    });
    if (!isOwner && !isManager) return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    if (offer.status === "ARCHIVED" || offer.status === "SUSPENDED") return NextResponse.json({ success: false, message: `لا يمكن التعديل في حالة ${offer.status}` }, { status: 400 });
    const deleted = await prisma.wholesaleOfferPackage.deleteMany({ where: { id: pid, offerId } });
    if (deleted.count === 0) return NextResponse.json({ success: false, message: "الرزمة غير موجودة" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("package DELETE:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}