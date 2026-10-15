import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { AccessPolicyService } from "@/services/access-policy.service";
import { AuditService } from "@/services/audit.service";

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

    // ═══ فحص الوصول ═══
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
        items: {
          select: {
            id: true,
            productName: true,
            variantName: true,
            quantity: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      );
    }

    // ═══ استخراج الاسم الكامل بأمان ═══
    const shippingSnap = (order.shippingAddressSnapshot || {}) as any;
    const customerSnap = (order.customerSnapshot || {}) as any;

    const customerFullName =
      shippingSnap.fullName ||
      (shippingSnap.firstName || shippingSnap.lastName
        ? `${shippingSnap.firstName || ""} ${shippingSnap.lastName || ""}`.trim()
        : "") ||
      customerSnap.name ||
      "—";

    // ═══ Audit: البائع اطلع على الاسم لغرض الطباعة ═══
    const reqInfo = AuditService.getRequestInfo(request);
    await AuditService.log({
      userId: auth.user.id,
      action: "UPDATE",
      entity: "Order",
      entityId: String(orderId),
      newData: {
        action: "seller_label_viewed",
        orderNumber: order.orderNumber,
        reason: "Print shipping label (name only for fulfillment)",
      },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    // ═══ رد مُقلَّص — الاسم فقط + بيانات الملصق ═══
    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: Number(order.total),
        createdAt: order.createdAt,
        deliveryToken: order.deliveryToken,

        // ═══ الاسم فقط — لا عنوان ولا هاتف ═══
        customerFullName,

        // ═══ الألوان ═══
        shippingCityColor: order.shippingCityColor,
        shippingDistrictColor: order.shippingDistrictColor,

        // ═══ المنتجات ═══
        items: order.items,
      },
    });
  } catch (error) {
    console.error("Seller label GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}