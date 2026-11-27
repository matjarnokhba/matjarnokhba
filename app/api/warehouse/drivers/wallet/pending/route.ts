import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { LogisticsScopeService } from "@/services/logistics-scope.service";
import { hasAnyLogisticsAccess } from "@/lib/logistics-scope";
import { driverWhere } from "@/lib/warehouse-route-scope";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    const gateScope = current ? await LogisticsScopeService.forUser(current.user.id, current.user.role) : null;
    if (!current || !gateScope || !hasAnyLogisticsAccess(gateScope)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const drivers = await prisma.deliveryPerson.findMany({
      where: { status: "ACTIVE", deletedAt: null, ...(await driverWhere(await LogisticsScopeService.forUser(current.user.id, current.user.role))) },
      include: { user: { select: { name: true, phone: true } } }
    });

    const driversWithBalance = await Promise.all(drivers.map(async (driver) => {
      const wallet = await prisma.wallet.findUnique({
        where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: driver.id } }
      });
      return {
        id: driver.id,
        name: driver.user.name,
        phone: driver.user.phone,
        balance: wallet ? Number(wallet.balance) : 0,
        cashInHand: wallet ? Number(wallet.cashInHand) : 0,
        isBlocked: wallet?.isBlocked || false,
      };
    }));

    return NextResponse.json({ success: true, drivers: driversWithBalance });
  } catch (error) {
    console.error("Pending wallet GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}