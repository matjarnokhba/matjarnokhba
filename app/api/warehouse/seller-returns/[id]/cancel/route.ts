import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const batchId = parseInt(id);
    if (isNaN(batchId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const batch = await prisma.sellerReturnBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json(
        { success: false, message: "الدفعة غير موجودة" },
        { status: 404 }
      );
    }

    if (batch.status !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          message: "لا يمكن إلغاء دفعة تم استلامها من الجامع",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.sellerReturnItem.deleteMany({
        where: { batchId },
      });
      await tx.sellerReturnBatch.update({
        where: { id: batchId },
        data: { status: "CANCELLED", confirmedAt: new Date() },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel seller return error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}