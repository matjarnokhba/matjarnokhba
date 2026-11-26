import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { AuditService } from "@/services/audit.service";
import { decrypt } from "@/lib/encryption";
import { isUploadThingUrl } from "@/lib/upload-url";
import { PAYOUT_METHOD_LABEL } from "@/lib/refund-payout-status";

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

// ═══ GET — التفاصيل مع فك التشفير (للإدارة فقط + تسجيل في التدقيق) ═══
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }
    const { id } = await params;
    const payoutId = Number.parseInt(id, 10);
    if (!Number.isInteger(payoutId) || payoutId <= 0) {
      return NextResponse.json({ success: false, message: "معرّف غير صحيح" }, { status: 400 });
    }

    const p = await prisma.returnRefundPayout.findUnique({
      where: { id: payoutId },
      include: {
        returnRequest: {
          select: { orderId: true, order: { select: { orderNumber: true } } },
        },
      },
    });
    if (!p) {
      return NextResponse.json({ success: false, message: "غير موجود" }, { status: 404 });
    }

    let holderName: string | null = null;
    let rib: string | null = null;
    try {
      holderName = decrypt(p.holderNameEnc);
      if (p.ribEnc) rib = decrypt(p.ribEnc);
    } catch (err) {
      console.error("Payout decrypt error:", err);
    }

    const customer = await prisma.user.findUnique({
      where: { id: p.userId },
      select: { name: true, phone: true },
    });

    await AuditService.log({
      userId: auth.user.id,
      action: "PAYMENT_CHANGE",
      entity: "ReturnRefundPayout",
      entityId: p.id,
      newData: { event: "REVEAL_DETAILS", method: p.method },
    });

    return NextResponse.json({
      success: true,
      payout: {
        id: p.id,
        method: p.method,
        status: p.status,
        amount: p.amount === null ? null : Number(p.amount),
        bankName: p.bankName,
        holderNameMasked: p.holderNameMasked,
        ribMasked: p.ribMasked,
        holderName,
        rib,
        cinImageUrl: p.cinImageUrl,
        reference: p.reference,
        proofUrl: p.proofUrl,
        adminNote: p.adminNote,
        sentAt: p.sentAt,
        completedAt: p.completedAt,
        createdAt: p.createdAt,
        orderId: p.returnRequest.orderId,
        orderNumber: p.returnRequest.order.orderNumber,
        customer,
      },
    });
  } catch (error) {
    console.error("Admin refund payout GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("mark_sent"),
    reference: z.string().trim().min(3, "أدخل مرجع عملية التحويل").max(100),
    proofUrl: z.string().trim().url().max(500).optional(),
    adminNote: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("complete"),
    adminNote: z.string().trim().max(500).optional(),
  }),
]);

// ═══ PATCH — تم إرسال المبلغ / مكتمل ═══
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }
    const { id } = await params;
    const payoutId = Number.parseInt(id, 10);
    if (!Number.isInteger(payoutId) || payoutId <= 0) {
      return NextResponse.json({ success: false, message: "معرّف غير صحيح" }, { status: 400 });
    }

    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }
    const d = parsed.data;
    if (d.action === "mark_sent" && d.proofUrl && !isUploadThingUrl(d.proofUrl)) {
      return NextResponse.json({ success: false, message: "رابط إثبات الدفع غير صالح" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // claim ذري: ينجح طلب واحد فقط مهما تزامنت الطلبات
      const claim =
        d.action === "mark_sent"
          ? await tx.returnRefundPayout.updateMany({
              where: { id: payoutId, status: "PROCESSING", amount: { not: null } },
              data: {
                status: "SENT",
                reference: d.reference,
                proofUrl: d.proofUrl,
                adminNote: d.adminNote || undefined,
                sentAt: new Date(),
                sentById: auth.user.id,
              },
            })
          : await tx.returnRefundPayout.updateMany({
              where: { id: payoutId, status: "SENT" },
              data: {
                status: "COMPLETED",
                completedAt: new Date(),
                adminNote: d.adminNote || undefined,
              },
            });
      if (claim.count !== 1) throw new Error("لا يمكن تنفيذ هذا الإجراء على الحالة الحالية");

      const p = await tx.returnRefundPayout.findUnique({
        where: { id: payoutId },
        include: { returnRequest: { select: { orderId: true } } },
      });
      if (!p) throw new Error("غير موجود");

      const label = PAYOUT_METHOD_LABEL[p.method] ?? p.method;
      const amountText = p.amount === null ? "" : `${Number(p.amount).toFixed(2)} د.م`;

      await tx.notification.create({
        data: {
          userId: p.userId,
          type: "RETURN_COMPLETED",
          title: d.action === "mark_sent" ? "تم إرسال مبلغ الإرجاع" : "اكتمل استرداد مبلغك",
          message:
            d.action === "mark_sent"
              ? p.method === "BANK"
                ? `تم تحويل ${amountText} إلى حسابك البنكي. مرجع العملية: ${p.reference}.`
                : `تم إرسال ${amountText} عبر ${label}. مرجع العملية: ${p.reference}. يمكنك استلامه من أي وكالة ببطاقتك الوطنية.`
              : `اكتملت عملية استرداد ${amountText} عبر ${label}. شكراً لثقتك.`,
          link: `/orders/${p.returnRequest.orderId}`,
          category: "ORDER",
          severity: "INFO",
        },
      });

      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "PAYMENT_CHANGE",
        entity: "ReturnRefundPayout",
        entityId: payoutId,
        oldData: { status: d.action === "mark_sent" ? "PROCESSING" : "SENT" },
        newData: {
          status: p.status,
          reference: p.reference,
          hasProof: !!p.proofUrl,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}