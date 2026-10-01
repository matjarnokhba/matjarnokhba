import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireSeller() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };
  return { user: current.user, seller: current.user.seller };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSeller();
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
    console.error("Seller notification PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}