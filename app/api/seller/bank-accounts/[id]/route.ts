import { NextResponse } from "next/server";
import { z } from "zod";
import { BankAccountService } from "@/services/bank-account.service";
import { requireSellerOwner } from "@/lib/seller-guards";

const actionSchema = z.object({
  action: z.enum(["set_default", "deactivate"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireSellerOwner();
    if (!guard.ok) return guard.response;

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

    const sellerId = guard.current.user.seller!.id;

    if (parsed.data.action === "set_default") {
      await BankAccountService.setDefault(sellerId, accountId);
    } else {
      await BankAccountService.deactivate(sellerId, accountId);
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
    const guard = await requireSellerOwner();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const accountId = parseInt(id);
    if (isNaN(accountId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    await BankAccountService.remove(guard.current.user.seller!.id, accountId);

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