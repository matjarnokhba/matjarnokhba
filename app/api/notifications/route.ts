import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { NotificationService } from "@/services/notification.service";

export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20"),
      50
    );

    const [notifications, unreadCount] = await Promise.all([
      NotificationService.getByUser(current.user.id, limit),
      NotificationService.getUnreadCount(current.user.id),
    ]);

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Notifications GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function POST() {
  // للسماح بـ mark-all من نفس المسار
  return NextResponse.json(
    { success: false, message: "استخدم POST /api/notifications/read-all" },
    { status: 405 }
  );
}