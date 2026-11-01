import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { checkBusinessAccess } from "@/lib/business-access";
import { LedgerService } from "@/services/ledger.service";

const schema = z.object({
  action: z.enum(["confirm", "reject"]),
  reason: z.string().trim().max(500).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const { id, transactionId } = await params;
    const businessId = parseInt(id);
    const txId = parseInt(transactionId);
    if (isNaN(businessId) || isNaN(txId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }
    const access = await checkBusinessAccess(businessId, current.user.id, ["MANAGER", "ACCOUNTANT"]);
    if ("error" in access) {
      return NextResponse.json({ success: false, message: access.error }, { status: access.status });
    }
    if (!access.canWrite) {
      return NextResponse.json({ success: false, message: "صلاحية محاسب مطلوبة" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const t = await prisma.ledgerTransaction.findUnique({ where: { id: txId } });
    if (!t) {
      return NextResponse.json({ success: false, message: "المعاملة غير موجودة" }, { status: 404 });
    }
    const isParty = t.debtorBusinessId === businessId || t.creditorBusinessId === businessId;
    if (!isParty) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    if (t.createdByUserId === current.user.id) {
      return NextResponse.json(
        { success: false, message: "لا يمكنك تأكيد معاملة أنشأتها بنفسك" },
        { status: 403 }
      );
    }

    const result =
      parsed.data.action === "confirm"
        ? await LedgerService.confirm(txId, current.user.id)
        : await LedgerService.reject(txId, current.user.id, parsed.data.reason);

    return NextResponse.json({ success: true, transaction: result });
  } catch (error) {
    console.error("Ledger confirm error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}