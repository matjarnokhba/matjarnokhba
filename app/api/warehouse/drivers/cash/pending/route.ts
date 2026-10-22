import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(current.user.role)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const drivers = await prisma.deliveryPerson.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      include: { user: { select: { name: true, phone: true } } }
    });

    const driversWithPendingCash = await Promise.all(drivers.map(async (driver) => {
      // 1. إجمالي المبلغ الذي تم تحصيله (الشحنات المسلمة)
      const deliveredShipments = await prisma.shipment.aggregate({
        where: { deliveryPersonId: driver.id, status: "DELIVERED" },
        _sum: { totalCOD: true }
      });
      const totalCollected = Number(deliveredShipments._sum.totalCOD || 0);

      // 2. إجمالي المبلغ الذي تم تسليمه للمستودع
      const completedHandovers = await prisma.cashHandover.aggregate({
        where: { driverId: driver.id, status: "COMPLETED" },
        _sum: { amount: true }
      });
      const totalHandedOver = Number(completedHandovers._sum.amount || 0);

      const pendingCash = totalCollected - totalHandedOver;

      return {
        id: driver.id,
        name: driver.user.name,
        phone: driver.user.phone,
        pendingCash
      };
    }));

    return NextResponse.json({ success: true, drivers: driversWithPendingCash });
  } catch (error) {
    console.error("Pending cash GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}