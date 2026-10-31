import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function POST() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const supplier = await prisma.wholesaleSupplier.findUnique({
      where: { userId: current.user.id },
      select: { id: true, deletedAt: true },
    });

    if (!supplier || supplier.deletedAt) {
      return NextResponse.json({ success: false, message: "أنت غير منضم لسوق الجملة" }, { status: 400 });
    }

    const pending = await prisma.wholesaleOrder.count({
      where: {
        supplierId: supplier.id,
        status: { in: ["PENDING", "IMPORT_PENDING"] },
      },
    });
    if (pending > 0) {
      return NextResponse.json({
        success: false,
        message: `لديك ${pending} طلب/طلبات قيد المعالجة. أكملها أولاً.`,
      }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const deactivated = await tx.sellerOffer.updateMany({
        where: { wholesaleSupplierId: supplier.id, deletedAt: null },
        data: { isActive: false, deletedAt: new Date() },
      });
      await tx.wholesaleSupplier.update({
        where: { id: supplier.id },
        data: { status: "CLOSED", deletedAt: new Date(), isVerified: false },
      });
      return { deactivatedOffers: deactivated.count };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Leave wholesale error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}