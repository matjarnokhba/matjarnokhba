import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (
      !current ||
      !["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(current.user.role)
    ) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const drivers = await prisma.deliveryPerson.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      include: { user: { select: { name: true, phone: true } } },
    });

    const result = await Promise.all(
      drivers.map(async (driver) => {
        const wallet = await prisma.wallet.findUnique({
          where: {
            ownerType_ownerId: { ownerType: "DRIVER", ownerId: driver.id },
          },
        });

        // ═══ عدد المرتجعات المعلّقة (مرفوضة ولم تُرجع للمستودع) ═══
        const pendingRefusedCount = await prisma.shipmentItem.count({
          where: {
            refusedQuantity: { gt: 0 },
            returnedToWarehouseAt: null,
            shipment: { deliveryPersonId: driver.id },
          },
        });

        return {
          id: driver.id,
          name: driver.user.name,
          phone: driver.user.phone,
          cashInHand: wallet ? Number(wallet.cashInHand) : 0,
          pendingRefusedCount,
        };
      })
    );

    return NextResponse.json({ success: true, drivers: result });
  } catch (error) {
    console.error("Pending cash GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}