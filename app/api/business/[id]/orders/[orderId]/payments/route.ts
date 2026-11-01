import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { checkBusinessAccess } from "@/lib/business-access";
import { WholesaleOrderService } from "@/services/wholesale-order.service";

const paySchema = z.object({
  amount: z.number().positive(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const { id, orderId } = await params;
    const businessId = parseInt(id);
    const oid = parseInt(orderId);
    if (isNaN(businessId) || isNaN(oid)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }
    const access = await checkBusinessAccess(businessId, current.user.id);
    if ("error" in access) {
      return NextResponse.json({ success: false, message: access.error }, { status: access.status });
    }
    const order = await prisma.wholesaleOrder.findUnique({
      where: { id: oid },
      select: { total: true, buyerBusinessId: true, sellerBusinessId: true, status: true },
    });
    if (!order) {
      return NextResponse.json({ success: false, message: "الطلب غير موجود" }, { status: 404 });
    }
    if (order.buyerBusinessId !== businessId && order.sellerBusinessId !== businessId) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const payments = await prisma.ledgerTransaction.findMany({
      where: { orderId: oid, type: "PAYMENT" },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    const totalPaid = payments
      .filter((p) => p.status === "CONFIRMED")
      .reduce((s, p) => s + Number(p.amount), 0);
    const total = Number(order.total);
    return NextResponse.json({
      success: true,
      payments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
      summary: { total, totalPaid, remaining: total - totalPaid },
    });
  } catch (error) {
    console.error("Payments GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const { id, orderId } = await params;
    const businessId = parseInt(id);
    const oid = parseInt(orderId);
    if (isNaN(businessId) || isNaN(oid)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }
    const body = await request.json();
    const parsed = paySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }
    const payment = await WholesaleOrderService.recordPayment(
      oid,
      businessId,
      current.user.id,
      parsed.data.amount,
      parsed.data.notes
    );
    return NextResponse.json(
      { success: true, payment: { ...payment, amount: Number(payment.amount) } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Payment POST error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}