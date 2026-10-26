import { NextResponse } from "next/server";
import { z } from "zod";
import { BankAccountService } from "@/services/bank-account.service";
import { requireSellerOwner } from "@/lib/seller-guards";

const createSchema = z.object({
  bankName: z.string().trim().min(2).max(80),
  accountHolder: z.string().trim().min(3).max(120),
  iban: z.string().trim().min(15).max(34),
  rib: z.string().trim().max(30).optional(),
  businessName: z.string().trim().max(120).optional(),
  accountType: z.enum(["PERSONAL", "BUSINESS"]).default("PERSONAL"),
  currency: z.string().trim().length(3).default("MAD"),
});

export async function GET() {
  try {
    const guard = await requireSellerOwner();
    if (!guard.ok) return guard.response;

    const accounts = await BankAccountService.list(guard.current.user.seller!.id);
    return NextResponse.json({ success: true, accounts });
  } catch (error) {
    console.error("Bank accounts GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireSellerOwner();
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const account = await BankAccountService.create(
      guard.current.user.seller!.id,
      parsed.data
    );

    return NextResponse.json({ success: true, account });
  } catch (error) {
    console.error("Bank accounts POST error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}