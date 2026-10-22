import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(current.user.role)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    // معرف المستودع الافتراضي (يمكن تعديله لاحقاً ليدعم مستودعات متعددة)
    const warehouseId = 1; 
    const ownerType = "WAREHOUSE";

    const wallet = await prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: ownerType as any, ownerId: warehouseId } },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 50,
        }
      }
    });

    return NextResponse.json({
      success: true,
      balance: wallet ? Number(wallet.balance) : 0,
      heldBalance: wallet ? Number(wallet.heldBalance) : 0,
      transactions: wallet?.transactions || [],
    });
  } catch (error) {
    console.error("Warehouse wallet GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}