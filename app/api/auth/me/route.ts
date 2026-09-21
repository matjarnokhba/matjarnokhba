import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    // 1. اقرأ الجلسة الحالية
    const current = await SessionService.getCurrent();

    // 2. إذا لا جلسة → 401
    if (!current) {
      return NextResponse.json(
        {
          success: false,
          message: "غير مصرح بالدخول",
        },
        { status: 401 }
      );
    }

    // 3. أرجع بيانات المستخدم
    return NextResponse.json({
      success: true,
      user: {
        id: current.user.id,
        name: current.user.name,
        email: current.user.email,
        phone: current.user.phone,
        role: current.user.role,
      },
    });
  } catch (error) {
    console.error("Me error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ غير متوقع",
      },
      { status: 500 }
    );
  }
}