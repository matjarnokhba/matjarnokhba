import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthService } from "@/services/auth.service";

export async function POST(request: Request) {
  try {
    // 1. اقرأ البيانات من الطلب
    const body = await request.json();

    // 2. سج​ل المستخدم عبر AuthService
    const user = await AuthService.register(body);

    // 3. أرجع النتيجة
    return NextResponse.json(
      {
        success: true,
        message: "تم إنشاء الحساب بنجاح",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    // معالجة أخطاء Zod (التحقق من البيانات)
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

    // معالجة باقي الأخطاء (البريد مكرر، ...)
    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 400 }
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