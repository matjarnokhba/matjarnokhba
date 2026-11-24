import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { WalletTransactionType } from "@/app/generated/prisma/enums";
import { releasedHeldIds, releaseKey, releaseDescription } from "@/lib/release-holds";

// تحرير الأرباح المحجوزة بعد 3 أيام: ذرّي، بمفتاح فريد، ويؤجل الطلبات التي عليها إرجاع معلّق
export async function POST() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 3);

    // ما حُرّر سابقاً (بالمفتاح أو بالوصف القديم بمطابقة دقيقة)
    const releases = await prisma.walletTransaction.findMany({
      where: { type: WalletTransactionType.RELEASE_HOLD },
      select: { description: true, idempotencyKey: true },
    });
    const done = releasedHeldIds(releases);

    const held = await prisma.walletTransaction.findMany({
      where: {
        type: WalletTransactionType.HELD_EARNING,
        createdAt: { lte: cutoff },
        ...(done.size > 0 ? { id: { notIn: Array.from(done) } } : {}),
      },
      orderBy: { id: "asc" },
      take: 500,
      select: { id: true, sellerId: true, amount: true, orderId: true },
    });

    // طلبات عليها إرجاع قيد الدراسة/الموافقة: لا تُحرَّر أرباحها الآن
    const orderIds = Array.from(new Set(held.map((h) => h.orderId).filter((x): x is number => x !== null)));
    const pendingReturns = orderIds.length
      ? await prisma.returnRequest.findMany({
          where: { orderId: { in: orderIds }, status: { in: ["PENDING", "APPROVED"] } },
          select: { orderId: true },
        })
      : [];
    const blockedOrders = new Set(pendingReturns.map((r) => r.orderId));

    let releasedCount = 0;
    let skippedPendingReturn = 0;

    for (const h of held) {
      if (h.orderId !== null && blockedOrders.has(h.orderId)) {
        skippedPendingReturn++;
        continue;
      }
      try {
        await prisma.$transaction(async (tx) => {
          const updated = await tx.seller.update({
            where: { id: h.sellerId },
            data: {
              walletBalance: { increment: h.amount },
              heldBalance: { decrement: h.amount },
            },
            select: { walletBalance: true },
          });
          const afterBal = Number(updated.walletBalance);
          const beforeBal = Math.round((afterBal - Number(h.amount)) * 100) / 100;
          // المفتاح الفريد: لو سبقنا أحد، يفشل هذا السطر وتُلغى المعاملة كلها
          await tx.walletTransaction.create({
            data: {
              sellerId: h.sellerId,
              orderId: h.orderId,
              idempotencyKey: releaseKey(h.id),
              type: WalletTransactionType.RELEASE_HOLD,
              amount: h.amount,
              balanceBefore: beforeBal,
              balanceAfter: afterBal,
              description: releaseDescription(h.id),
            },
          });
        });
        releasedCount++;
      } catch (e) {
        if ((e as { code?: string })?.code === "P2002") continue; // حُرّر للتو من عملية أخرى
        throw e;
      }
    }

    return NextResponse.json({ success: true, releasedCount, skippedPendingReturn });
  } catch (error) {
    console.error("release-holds failed", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}