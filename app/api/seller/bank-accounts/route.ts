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
    const auth = await requireSeller();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const accounts = await BankAccountService.list(auth.seller.id);
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
    const auth = await requireSeller();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

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
      auth.seller.id,
      parsed.data
    );

    return NextResponse.json({ success: true, account }, { status: 201 });
  } catch (error) {
    console.error("Bank account POST error:", error);
    const message = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}