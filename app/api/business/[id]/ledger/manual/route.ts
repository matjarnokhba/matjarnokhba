import { NextResponse } from "next/server";
import { z } from "zod";
import { SessionService } from "@/services/session.service";
import { checkBusinessAccess } from "@/lib/business-access";
import { LedgerService } from "@/services/ledger.service";

const schema = z.object({
  counterpartyBusinessId: z.number().int().positive(),
  direction: z.enum(["we_owe", "they_owe"]),
  type: z.enum(["SALE", "PAYMENT", "REFUND", "ADJUSTMENT"]),
  amount: z.number().positive(),
  currency: z.string().length(3).default("MAD"),
  externalRef: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const { id } = await params;
    const businessId = parseInt(id);
    if (isNaN(businessId)) {
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
    const d = parsed.data;

    const debtorBusinessId = d.direction === "we_owe" ? businessId : d.counterpartyBusinessId;
    const creditorBusinessId = d.direction === "we_owe" ? d.counterpartyBusinessId : businessId;

    const transaction = await LedgerService.recordExternal({
      type: d.type,
      ownerBusinessId: businessId,
      counterpartyBusinessId: d.counterpartyBusinessId,
      debtorBusinessId,
      creditorBusinessId,
      amount: d.amount,
      createdByUserId: current.user.id,
      externalRef: d.externalRef,
      notes: d.notes,
    });
    return NextResponse.json({ success: true, transaction }, { status: 201 });
  } catch (error) {
    console.error("Ledger manual entry error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}