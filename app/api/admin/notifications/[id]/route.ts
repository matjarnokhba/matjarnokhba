import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

// ═══ GET — تفاصيل إشعار ═══
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const notifId = parseInt(id);
    if (isNaN(notifId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.findFirst({
      where: { id: notifId, userId: auth.user.id },
    });

    if (!notification) {
      return NextResponse.json(
        { success: false, message: "الإشعار غير موجود" },
        { status: 404 }
      );
    }

    // علّم كمقروء
    if (!notification.isRead) {
      await prisma.notification.update({
        where: { id: notifId },
        data: { isRead: true, readAt: new Date() },
      });
    }

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error("Admin notification GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══ PATCH — تحديث الحالة ═══
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const notifId = parseInt(id);
    if (isNaN(notifId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    await prisma.notification.updateMany({
      where: { id: notifId, userId: auth.user.id },
      data: { isRead: true, readAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin notification PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}