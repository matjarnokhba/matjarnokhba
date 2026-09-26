import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { NotificationService } from "@/services/notification.service";

export async function POST() {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    await NotificationService.markAllAsRead(current.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notifications read-all error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}