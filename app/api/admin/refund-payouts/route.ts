import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { RefundPayoutStatus } from "@/app/generated/prisma/enums";

export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const statusParam = new URL(request.url).searchParams.get("status");
    const validStatus = (Object.values(RefundPayoutStatus) as string[]).includes(statusParam ?? "")
      ? (statusParam as RefundPayoutStatus)
      : null;

    // لا تظهر إلا الاستردادات التي أُكمل إرجاعها (المبلغ محدّد)
    const rows = await prisma.returnRefundPayout.findMany({
      where: validStatus ? { amount: { not: null }, status: validStatus } : { amount: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        returnRequest: {
          select: { orderId: true, order: { select: { orderNumber: true } } },
        },
      },
    });

    const userIds = Array.from(new Set(rows.map((r) => r.userId)));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, phone: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      success: true,
      payouts: rows.map((r) => ({
        id: r.id,
        method: r.method,
        status: r.status,
        amount: r.amount === null ? null : Number(r.amount),
        bankName: r.bankName,
        holderNameMasked: r.holderNameMasked,
        ribMasked: r.ribMasked,
        reference: r.reference,
        createdAt: r.createdAt,
        orderId: r.returnRequest.orderId,
        orderNumber: r.returnRequest.order.orderNumber,
        customer: byId.get(r.userId) ?? null,
      })),
    });
  } catch (error) {
    console.error("Admin refund payouts list error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}