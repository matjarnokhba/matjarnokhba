import { NextResponse } from "next/server";
import { z } from "zod";
import { PasswordResetService } from "@/services/password-reset.service";

const schema = z.object({
  email: z.string().trim().email("بريد إلكتروني غير صحيح"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const token = await PasswordResetService.createToken(parsed.data.email);

    let resetUrl: string | undefined;

    if (token) {
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      resetUrl = `${baseUrl}/reset-password?token=${token}`;
      console.log("\n🔑 PASSWORD RESET LINK:");
      console.log(resetUrl);
      console.log("");
    }

    return NextResponse.json({
      success: true,
      message: "إذا كان البريد موجوداً، سيصلك رابط لإعادة التعيين",
      ...(process.env.NODE_ENV !== "production" && { resetUrl }),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}