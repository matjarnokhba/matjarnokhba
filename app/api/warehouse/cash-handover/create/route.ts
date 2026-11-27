import { ActorWarehouse } from "@/services/actor-warehouse.service";
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { LogisticsScopeService } from "@/services/logistics-scope.service";
import { driverWhere } from "@/lib/warehouse-route-scope";

const schema = z.object({
  driverId: z.number().int().positive(),
  actualAmount: z.number().min(0),
});

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(current.user.role)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });

    const scopedDriver = await prisma.deliveryPerson.findFirst({
      where: { id: parsed.data.driverId, ...(await driverWhere(await LogisticsScopeService.forUser(current.user.id, current.user.role))) },
      select: { id: true },
    });
    if (!scopedDriver) {
      return NextResponse.json({ success: false, message: "السائق غير موجود" }, { status: 404 });
    }const driverWallet = await prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: parsed.data.driverId } },
    });

    const expectedAmount = driverWallet ? Number(driverWallet.cashInHand) : 0;
    if (expectedAmount <= 0) {
      return NextResponse.json(
        { success: false, message: "هذا السائق لا يحمل أي كاش حالياً" },
        { status: 400 }
      );
    }

    const actualAmount = parsed.data.actualAmount;
    const shortfall = Math.max(0, expectedAmount - actualAmount);
    const handoverToken = crypto.randomUUID();

    const actorWarehouseId = await ActorWarehouse.forUser(current.user.id);
    const handover = await prisma.cashHandover.create({
      data: {
        driverId: parsed.data.driverId,
        warehouseId: current.user.id, // من استلم فعلياً (audit)
        warehouseRefId: actorWarehouseId,
        amount: actualAmount,
        shortfall,
        handoverToken,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      handoverId: handover.id,
      qrToken: handoverToken,
      expectedAmount,
      actualAmount,
      shortfall,
    });
  } catch (error) {
    console.error("Cash handover create error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}