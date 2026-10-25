import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AssemblyService } from "@/services/assembly.service";

export async function GET(request: Request) {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");

    if (!expectedSecret || authHeader !== "Bearer " + expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("بدء المزامنة الاحتياطية لملفات التجميع...");

    const activeUsers = await prisma.fulfillmentItem.findMany({
      where: {
        status: {
          notIn: ["CANCELLED", "RETURNED", "DELIVERED"],
        },
        orderItem: {
          order: {
            status: { notIn: ["CANCELLED", "RETURNED", "DELIVERED"] },
          },
        },
      },
      select: {
        orderItem: {
          select: {
            order: { select: { userId: true } },
          },
        },
      },
    });

    const userIds = Array.from(
      new Set(
        activeUsers
          .map((fi) => fi.orderItem?.order?.userId)
          .filter((id): id is number => typeof id === "number")
      )
    );

    console.log(userIds.length + " مستخدم بحاجة للمزامنة");

    let syncedCount = 0;
    let failedCount = 0;

    for (const userId of userIds) {
      try {
        await prisma.$transaction(async (tx) => {
          await AssemblyService.rebuildForUser(tx, userId);
        });
        syncedCount++;
      } catch (e) {
        console.error("Failed to sync user " + userId + ":", e);
        failedCount++;
      }
    }

    console.log("synced: " + syncedCount + ", failed: " + failedCount);

    return NextResponse.json({
      success: true,
      syncedCount,
      failedCount,
      totalUsers: userIds.length,
    });
  } catch (error) {
    console.error("Cron sync-assemblies error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}