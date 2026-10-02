import { NextResponse } from "next/server";
import { z } from "zod";
import { SessionService } from "@/services/session.service";
import { BankAccountService } from "@/services/bank-account.service";

async function requireSeller() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };
  return { user: current.user, seller: current.user.seller };
}

const actionSchema = z.object({
  action: z.enum(["set_default", "deactivate"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSeller();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const accountId = parseInt(id);
    if (isNaN(accountId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "إجراء غير صحيح" },
        { status: 400 }
      );
    }

    if (parsed.data.action === "set_default") {
      await BankAccountService.setDefault(auth.seller.id, accountId);
    } else {
      await BankAccountService.deactivate(auth.seller.id, accountId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Bank account PATCH error:", error);
    const message = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSeller();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const accountId = parseInt(id);
    if (isNaN(accountId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    await BankAccountService.remove(auth.seller.id, accountId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Bank account DELETE error:", error);
    const message = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}