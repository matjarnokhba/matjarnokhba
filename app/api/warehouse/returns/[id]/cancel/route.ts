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

    const batch = await prisma.refusedHandoverBatch.findUnique({
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
        { success: false, message: "لا يمكن إلغاء دفعة غير معلّقة" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.refusedHandoverItem.deleteMany({
        where: { batchId },
      });
      await tx.refusedHandoverBatch.update({
        where: { id: batchId },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel refused handover error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}