import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "COLLECTOR") {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const batches = await prisma.sellerReturnBatch.findMany({
      where: {
        collectorId: current.user.id,
        status: { in: ["PICKED_UP", "CONFIRMED"] },
      },
      include: {
        seller: { select: { storeName: true } },
      },
      orderBy: { pickedUpAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ success: true, batches });
  } catch (error) {
    console.error("Collector history error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}