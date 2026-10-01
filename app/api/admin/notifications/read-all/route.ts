import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function POST() {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }
    if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const result = await prisma.notification.updateMany({
      where: { userId: current.user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Admin read-all error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}