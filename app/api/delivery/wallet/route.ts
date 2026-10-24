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

    // ═══ حساب حظر ديناميكي (لا نثق بالـ flag المخزن) ═══
    const cashInHand = wallet ? Number(wallet.cashInHand) : 0;
    const cashHeldSince = wallet?.cashHeldSince || null;
    const cashHeldHours = cashHeldSince
      ? Math.floor((Date.now() - new Date(cashHeldSince).getTime()) / (1000 * 60 * 60))
      : 0;

    const pendingRefused = await prisma.shipmentItem.count({
      where: {
        shipment: { deliveryPersonId: person.id },
        refusedAt: { not: null },
        returnedToWarehouseAt: null,
      },
    });

    const isHeldOver24h = cashHeldHours >= 24;
    const isBlocked = (cashInHand > 0 && isHeldOver24h) || pendingRefused > 0;

    let blockReason: string | null = null;
    if (isBlocked) {
      blockReason =
        cashInHand > 0 && isHeldOver24h
          ? `كاش محتجز لأكثر من ${cashHeldHours} ساعة`
          : "بضاعة مرفوضة لم تُرجع للمستودع";
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
      transactions: wallet?.transactions || [],
      legalNotices,
    });
  } catch (error) {
    console.error("Driver wallet GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}