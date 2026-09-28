import { NextResponse } from "next/server";
import { z } from "zod";
import { PasswordResetService } from "@/services/password-reset.service";

const schema = z.object({
  token: z.string().min(10, "الرابط غير صحيح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
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

    await PasswordResetService.resetPassword(
      parsed.data.token,
      parsed.data.password
    );

    return NextResponse.json({
      success: true,
      message: "تم تعيين كلمة المرور بنجاح",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    const message = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}