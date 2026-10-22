import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { WalletOwnerType } from "@/app/generated/prisma/enums";

const schema = z.object({
  token: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "DELIVERY") {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, message: "رمز غير صحيح" }, { status: 400 });

    const person = await prisma.deliveryPerson.findUnique({
      where: { userId: current.user.id },
      select: { id: true }
    });

    if (!person) return NextResponse.json({ success: false, message: "السائق غير موجود" }, { status: 404 });

    const handover = await prisma.cashHandover.findUnique({
      where: { handoverToken: parsed.data.token }
    });

    if (!handover || handover.driverId !== person.id || handover.status !== "PENDING") {
      return NextResponse.json({ success: false, message: "الطلب غير صالح أو تم تسليمه مسبقاً" }, { status: 400 });
    }

    // تنفيذ عملية الاعتراف بالاستلام
    await prisma.$transaction(async (tx) => {
      // 1. تحديث حالة التسليم
      await tx.cashHandover.update({
        where: { id: handover.id },
        data: { status: "COMPLETED", completedAt: new Date() }
      });

      // 2. إنشاء محفظة السائق إذا لم تكن موجودة، وتحديث الرصيد بخصم النقص إن وجد
      const driverWallet = await tx.wallet.upsert({
        where: { ownerType_ownerId: { ownerType: WalletOwnerType.DRIVER, ownerId: person.id } },
        create: { ownerType: WalletOwnerType.DRIVER, ownerId: person.id, balance: -Number(handover.shortfall) },
        update: { balance: { decrement: handover.shortfall } }
      });

      // 3. تسجيل حركة السائق (خصم النقص إن وجد)
      if (Number(handover.shortfall) > 0) {
        await tx.walletTransactionUnified.create({
          data: {
            walletId: driverWallet.id,
            amount: -Number(handover.shortfall),
            type: "SHORTFALL",
            description: `خصم عجز في تسليم الكاش (مستودع)`,
            referenceId: String(handover.id)
          }
        });
      }

      // 4. إنشاء/تحديث محفظة المستودع وإضافة المبلغ المستلم
      const warehouseWallet = await tx.wallet.upsert({
        where: { ownerType_ownerId: { ownerType: WalletOwnerType.WAREHOUSE, ownerId: handover.warehouseId } },
        create: { ownerType: WalletOwnerType.WAREHOUSE, ownerId: handover.warehouseId, balance: handover.amount },
        update: { balance: { increment: handover.amount } }
      });

      await tx.walletTransactionUnified.create({
        data: {
          walletId: warehouseWallet.id,
          amount: handover.amount,
          type: "CASH_COLLECTED",
          description: `استلام كاش من السائق #${person.id}`,
          referenceId: String(handover.id)
        }
      });
    });

    return NextResponse.json({
      success: true,
      amountReceived: handover.amount,
      shortfallDeducted: handover.shortfall
    });

  } catch (error) {
    console.error("Cash handover confirm error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}