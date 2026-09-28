import { NextResponse } from "next/server";
import { PasswordResetService } from "@/services/password-reset.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token || token.length < 10) {
      return NextResponse.json({
        success: true,
        valid: false,
        reason: "الرابط غير صحيح",
      });
    }

    const record = await PasswordResetService.verifyToken(token);

    if (!record) {
      // لم نجد الرابط — قد يكون مستخدماً أو منتهياً أو غير صحيح
      // نُعيد التحقق التفصيلي
      const detailed = await PasswordResetService.getTokenStatus(token);
      return NextResponse.json({
        success: true,
        valid: false,
        reason: detailed.reason || "الرابط غير صحيح أو منتهي الصلاحية",
      });
    }

    return NextResponse.json({
      success: true,
      valid: true,
      user: { name: record.user.name, email: record.user.email },
    });
  } catch (error) {
    console.error("Verify token error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}