import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthService } from "@/services/auth.service";
import { SessionService } from "@/services/session.service";

export async function POST(request: Request) {
  try {
    // 1. اقرأ البيانات
    const body = await request.json();

    // 2. تحقق من المستخدم (كلمة المرور)
    const user = await AuthService.login(body);

    // 3. أنشئ جلسة
    const userAgent = request.headers.get("user-agent") || undefined;
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      undefined;

    await SessionService.create(user.id, userAgent, ipAddress);

    // 4. أرجع النتيجة
    return NextResponse.json(
      {
        success: true,
        message: "تم تسجيل الدخول بنجاح",
        user,
      },
      { status: 200 }
    );
  } catch (error) {
    // أخطاء Zod (التحقق من البيانات)
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "بيانات غير صحيحة",
          errors: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    // أخطاء العمل (كلمة مرور خطأ، بريد غير موجود)
    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 401 }
      );
    }

    // خطأ غير متوقع
    console.error("Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ غير متوقع",
      },
      { status: 500 }
    );
  }
}
