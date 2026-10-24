import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({ token: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "DELIVERY") {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ success: false, message: "رمز غير صحيح" }, { status: 400 });

    const person = await prisma.deliveryPerson.findUnique({
      where: { userId: current.user.id },
      select: { id: true },
    });
    if (!person)
      return NextResponse.json({ success: false, message: "السائق غير موجود" }, { status: 404 });

    const handover = await prisma.cashHandover.findUnique({
      where: { handoverToken: parsed.data.token },
    });

    if (!handover || handover.driverId !== person.id || handover.status !== "PENDING") {
      return NextResponse.json(
        { success: false, message: "الطلب غير صالح أو تم تسليمه مسبقاً" },
        { status: 400 }
      );
    }

    const actualAmount = Number(handover.amount);
    const shortfall = Number(handover.shortfall);

    await prisma.$transaction(async (tx) => {
      // 1. جلب الشحنات المسلّمة التي لم يتم تحصيل كاشها بعد
      const uncollectedShipments = await tx.shipment.findMany({
        where: {
          deliveryPersonId: person.id,
          status: { in: ["DELIVERED", "PARTIALLY_DELIVERED"] },
          cashCollectedAt: null,
        },
        include: {
          items: {
            include: {
              order: { select: { subtotal: true, shippingCost: true } },
            },
          },
        },
      });

      // 2. حساب الأموال الموزعة
      let totalPlatformAmount = 0;
      let totalDriversAmount = 0;
      let totalWarehouseProfit = 0;
      let totalCOD = 0;

      const processedOrderIds = new Set<number>();

      for (const shipment of uncollectedShipments) {
        const driverFee = Number(shipment.driverFee);

        for (const item of shipment.items) {
          // تجنب حساب نفس الطلب مرتين
          if (processedOrderIds.has(item.orderId)) continue;
          processedOrderIds.add(item.orderId);

          const subtotal = Number(item.order.subtotal);
          const shipping = Number(item.order.shippingCost || 0);

          totalCOD += subtotal + shipping;
          totalPlatformAmount += subtotal; // الأدمن يأخذ أموال المنتجات
          totalWarehouseProfit += Math.max(0, shipping - driverFee);
        }

        // أجر السائق للشحنة كاملة
        totalDriversAmount += driverFee;
      }

      // 3. تحديث CashHandover
      await tx.cashHandover.update({
        where: { id: handover.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      // 4. تعليم الشحنات كمُحصّلة
      await tx.shipment.updateMany({
        where: { id: { in: uncollectedShipments.map((s) => s.id) } },
        data: { cashCollectedAt: new Date() },
      });

      // 5. محفظة السائق: خصم الكاش + النقص من الرصيد
      const driverWallet = await tx.wallet.findUnique({
        where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: person.id } },
      });
      if (!driverWallet) throw new Error("محفظة السائق غير موجودة");

      const totalExpected = actualAmount + shortfall;
      const cashAfter = Number(driverWallet.cashInHand) - totalExpected;

      await tx.wallet.update({
        where: { id: driverWallet.id },
        data: {
          cashInHand: { decrement: totalExpected },
          balance: { decrement: shortfall },
          ...(cashAfter <= 0 && {
            cashHeldSince: null,
            isBlocked: false,
            blockReason: null,
          }),
        },
      });

      if (shortfall > 0) {
        await tx.walletTransactionUnified.create({
          data: {
            walletId: driverWallet.id,
            amount: -shortfall,
            type: "SHORTFALL",
            description: `خصم عجز (تم تسليم ${actualAmount} من ${totalExpected})`,
          },
        });
      }

      // 6. محفظة المستودع: إضافة الأموال الموزعة
      const warehouseWallet = await tx.wallet.upsert({
        where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: 1 } },
        create: {
          ownerType: "WAREHOUSE",
          ownerId: 1,
          cashInHand: actualAmount,
          cashOwedToPlatform: totalPlatformAmount,
          cashOwedToDrivers: totalDriversAmount,
          balance: totalWarehouseProfit,
        },
        update: {
          cashInHand: { increment: actualAmount },
          cashOwedToPlatform: { increment: totalPlatformAmount },
          cashOwedToDrivers: { increment: totalDriversAmount },
          balance: { increment: totalWarehouseProfit },
        },
      });

      await tx.walletTransactionUnified.create({
        data: {
          walletId: warehouseWallet.id,
          amount: actualAmount,
          type: "CASH_COLLECTED",
          description: `تحصيل كاش (منتجات: ${totalPlatformAmount}، سائقين: ${totalDriversAmount}، ربح: ${totalWarehouseProfit})`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      amountReceived: actualAmount,
      shortfallDeducted: shortfall,
    });
  } catch (error) {
    console.error("Cash handover confirm error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}