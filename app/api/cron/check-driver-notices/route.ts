import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LegalNoticeService } from "@/services/legal-notice.service";

export async function GET(request: Request) {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    if (expectedSecret && authHeader !== "Bearer " + expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. رفع الإنذارات المنتهية
    const escalation = await LegalNoticeService.escalateExpired();

    // 2. مزامنة الإنذارات لكل سائق عنده مشاكل
    const now = Date.now();
    const drivers = await prisma.deliveryPerson.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });

    let synced = 0;
    for (const driver of drivers) {
      try {
        await prisma.$transaction(async (tx) => {
          const wallet = await tx.wallet.findUnique({
            where: {
              ownerType_ownerId: { ownerType: "DRIVER", ownerId: driver.id },
            },
          });
          if (!wallet) return;

          const cashInHand = Number(wallet.cashInHand);
          const cashHeldSince = wallet.cashHeldSince as Date | null;
          const isCashOver24h = cashHeldSince
            ? now - new Date(cashHeldSince).getTime() > 24 * 60 * 60 * 1000
            : false;

          const pendingRefused24h = await tx.shipmentItem.count({
            where: {
              shipment: { deliveryPersonId: driver.id },
              refusedQuantity: { gt: 0 },
              returnedToWarehouseAt: null,
              refusedAt: { lt: new Date(now - 24 * 60 * 60 * 1000) },
            },
          });

          if ((cashInHand > 0 && isCashOver24h) || pendingRefused24h > 0) {
            await LegalNoticeService.syncForDriver(tx, driver.id);
            synced++;
          } else {
            // مزامنة لإغلاق أي إنذار قديم
            await LegalNoticeService.syncForDriver(tx, driver.id);
          }
        });
      } catch (e) {
        console.error(`Sync failed for driver ${driver.id}:`, e);
      }
    }

    return NextResponse.json({
      success: true,
      escalated: escalation.escalated,
      synced,
    });
  } catch (error) {
    console.error("Cron check-driver-notices error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}