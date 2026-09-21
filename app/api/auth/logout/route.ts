import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";

export async function POST() {
  try {
    await SessionService.destroy();

    return NextResponse.json({
      success: true,
      message: "تم تسجيل الخروج بنجاح",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ غير متوقع",
      },
      { status: 500 }
    );
  }
}