import { LogisticsScopeService } from "@/services/logistics-scope.service";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET(request: Request) {
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

    const scope = await LogisticsScopeService.forUser(current.user.id, current.user.role);
    const wantedWh = Number(new URL(request.url).searchParams.get("warehouseId")) || (scope.platform ? 1 : scope.warehouseIds[0]) || 1;
    if (!scope.platform && !scope.warehouseIds.includes(wantedWh)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const whRow = await prisma.warehouse.findUnique({ where: { id: wantedWh }, select: { companyId: true } });
    const companyDrivers = await prisma.deliveryPerson.findMany({ where: { companyId: whRow?.companyId ?? 1 }, select: { id: true } });
    const companyDriverIds = companyDrivers.map((d) => d.id);
    const wallet = await prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: wantedWh } },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    // ✅ حساب cashOwedToDrivers ديناميكياً (مجموع أرصدة السائقين الفعلية)
    const driverWallets = await prisma.wallet.findMany({
      where: { ownerType: "DRIVER", ownerId: { in: companyDriverIds } },
      select: { balance: true },
    });
    const actualDriversOwed = driverWallets.reduce(
      (sum, w) => sum + Number(w.balance),
      0
    );

    return NextResponse.json({
      success: true,
      balance: wallet ? Number(wallet.balance) : 0,
      cashInHand: wallet ? Number(wallet.cashInHand) : 0,
      cashOwedToPlatform: wallet ? Number(wallet.cashOwedToPlatform) : 0,
      cashOwedToDrivers: actualDriversOwed, // ← ديناميكي
      transactions: wallet?.transactions || [],
    });
  } catch (error) {
    console.error("Warehouse wallet GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}