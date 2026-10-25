import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateDriverBlockStatus } from "@/services/wallet.service";

export async function GET(request: Request) {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    if (!expectedSecret || authHeader !== "Bearer " + expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // 1. إلغاء دفعات السائقين PENDING > 7 أيام
    const staleHandover = await prisma.refusedHandoverBatch.findMany({
      where: { status: "PENDING", createdAt: { lt: cutoff7d } },
      select: { id: true, driverId: true },
    });

    for (const batch of staleHandover) {
      await prisma.$transaction(async (tx) => {
        await tx.refusedHandoverItem.deleteMany({
          where: { batchId: batch.id },
        });
        await tx.refusedHandoverBatch.update({
          where: { id: batch.id },
          data: { status: "CANCELLED", completedAt: new Date() },
        });
        await updateDriverBlockStatus(tx, batch.driverId);
      });
    }

    // 2. إلغاء دفعات التجار PENDING > 7 أيام (لكن ليس PICKED_UP)
    const staleSeller = await prisma.sellerReturnBatch.findMany({
      where: { status: "PENDING", createdAt: { lt: cutoff7d } },
      select: { id: true },
    });

    for (const batch of staleSeller) {
      await prisma.$transaction(async (tx) => {
        await tx.sellerReturnItem.deleteMany({
          where: { batchId: batch.id },
        });
        await tx.sellerReturnBatch.update({
          where: { id: batch.id },
          data: { status: "CANCELLED", confirmedAt: new Date() },
        });
      });
    }

    return NextResponse.json({
      success: true,
      expiredHandovers: staleHandover.length,
      expiredSellerReturns: staleSeller.length,
    });
  } catch (error) {
    console.error("Cron expire-batches error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}