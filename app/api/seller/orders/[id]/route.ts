import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { AccessPolicyService } from "@/services/access-policy.service";

async function requireSeller() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };
  return { user: current.user, seller: current.user.seller };
}

export async function GET(
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
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    // ═══ فحص الوصول عبر AccessPolicyService ═══
    const access = await AccessPolicyService.canAccessOrder(
      {
        id: auth.user.id,
        role: auth.user.role,
        seller: { id: auth.seller.id },
      },
      orderId
    );

    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.reason },
        { status: 403 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      );
    }

    // ═══ تصفية PII حسب السياسة ═══
    const safeOrder = AccessPolicyService.filterOrderData(order, access);

    return NextResponse.json({ success: true, order: safeOrder });
  } catch (error) {
    console.error("Seller order GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}