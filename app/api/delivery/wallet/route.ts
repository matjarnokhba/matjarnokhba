import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "DELIVERY") {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const person = await prisma.deliveryPerson.findUnique({
      where: { userId: current.user.id },
      select: { id: true },
    });
    if (!person)
      return NextResponse.json({ success: false, message: "السائق غير موجود" }, { status: 404 });

    const wallet = await prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: person.id } },
      include: {
        transactions: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });

    const cashInHand = wallet ? Number(wallet.cashInHand) : 0;
    const cashHeldSince = wallet?.cashHeldSince || null;
    const cashHeldHours = cashHeldSince
      ? Math.floor((Date.now() - new Date(cashHeldSince).getTime()) / (1000 * 60 * 60))
      : 0;
    const isHeldOver24h = cashHeldHours >= 24;

    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const pendingRefusedCount = await prisma.shipmentItem.count({
      where: {
        shipment: { deliveryPersonId: person.id },
        refusedAt: { not: null },
        returnedToWarehouseAt: null,
      },
    });

    const pendingRefusedOver24hCount = await prisma.shipmentItem.count({
      where: {
        shipment: { deliveryPersonId: person.id },
        refusedAt: { not: null, lt: cutoff24h },
        returnedToWarehouseAt: null,
      },
    });

    const isBlocked =
      (cashInHand > 0 && isHeldOver24h) || pendingRefusedOver24hCount > 0;

    let blockReason: string | null = null;
    if (isBlocked) {
      if (cashInHand > 0 && isHeldOver24h) {
        blockReason = `كاش محتجز ${cashInHand.toFixed(2)} د.م منذ ${cashHeldHours} ساعة. يجب تسليمه للمستودع.`;
      }
      if (pendingRefusedOver24hCount > 0) {
        blockReason = `لديك ${pendingRefusedOver24hCount} منتج مرفوض منذ أكثر من 24 ساعة. يجب إرجاعه للمستودع.`;
      }
    }

    const legalNotices = await prisma.driverLegalNotice.findMany({
      where: { driverId: person.id, status: { in: ["WARNING", "ESCALATED"] } },
      orderBy: { deadlineAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      balance: wallet ? Number(wallet.balance) : 0,
      cashInHand,
      cashHeldSince,
      cashHeldHours,
      isBlocked,
      blockReason,
      pendingRefusedCount,
      pendingRefusedOver24hCount,
      transactions: wallet?.transactions || [],
      legalNotices,
    });
  } catch (error) {
    console.error("Driver wallet GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}