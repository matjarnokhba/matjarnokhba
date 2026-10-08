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

// ═══════ GET — قائمة السائقين النشطين ═══════
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
    const orderId = parseInt(id);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        deliveryPersonId: true,
        shippingAddressSnapshot: true,
        status: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      );
    }

    const address = order.shippingAddressSnapshot as any;
    const orderCity = (address?.city || "").trim();

    // ═══ السائقون النشطون ═══
    const persons = await prisma.deliveryPerson.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // ═══ حساب الطلبات النشطة + ترتيب حسب المدينة ═══
    const personsWithStats = [];
    for (const p of persons) {
      const activeCount = await prisma.order.count({
        where: {
          deliveryPersonId: p.id,
          status: { in: ["NEW", "PROCESSING", "SHIPPED"] },
        },
      });

      const sameCity = p.city.trim() === orderCity;

      personsWithStats.push({
        id: p.id,
        name: p.user.name,
        email: p.user.email,
        phone: p.phone,
        city: p.city,
        vehicleType: p.vehicleType,
        activeOrders: activeCount,
        sameCity,
      });
    }

    // رتّب: نفس المدينة أولاً، ثم الأقل انشغالاً
    personsWithStats.sort((a, b) => {
      if (a.sameCity !== b.sameCity) return a.sameCity ? -1 : 1;
      return a.activeOrders - b.activeOrders;
    });

    return NextResponse.json({
      success: true,
      currentDeliveryPersonId: order.deliveryPersonId,
      orderCity,
      persons: personsWithStats,
    });
  } catch (error) {
    console.error("Assign GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ PATCH — تعيين / إزالة السائق ═══════
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
    const orderId = parseInt(id);
    const body = await request.json();

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, sellerId: true, source: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      );
    }

    // ═══ لا يمكن إسناد طلب محل ═══
    if (order.source === "IN_STORE") {
      return NextResponse.json(
        {
          success: false,
          message: "طلبات المحل لا تحتاج توصيل",
        },
        { status: 400 }
      );
    }

    // ═══ لا يمكن إسناد طلب مكتمل/ملغى ═══
    if (
      order.status === "DELIVERED" ||
      order.status === "CANCELLED" ||
      order.status === "RETURNED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "لا يمكن إسناد الطلب في حالته الحالية",
        },
        { status: 400 }
      );
    }

    const personId = body.deliveryPersonId;

    // ═══ إزالة الإسناد ═══
    if (personId === null || personId === undefined) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          deliveryPersonId: null,
          assignedAt: null,
        },
      });

      return NextResponse.json({ success: true, message: "تم إلغاء الإسناد" });
    }

    // ═══ تحقق من السائق ═══
    const person = await prisma.deliveryPerson.findUnique({
      where: { id: personId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!person || person.deletedAt) {
      return NextResponse.json(
        { success: false, message: "السائق غير موجود" },
        { status: 404 }
      );
    }

    if (person.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "السائق غير نشط" },
        { status: 400 }
      );
    }

    // ═══ التعيين ═══
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          deliveryPersonId: personId,
          assignedAt: new Date(),
        },
      });

      // ═══ إشعار للسائق ═══
      await tx.notification.create({
        data: {
          userId: person.user.id,
          type: "ORDER_STATUS_CHANGED",
          title: "📦 طلب جديد مُسند إليك",
          message: `طلب جديد بانتظار التوصيل — #${orderId}`,
          link: `/delivery/orders/${orderId}`,
          category: "ORDER",
          severity: "INFO",
          metadata: {
            orderId,
            sellerId: order.sellerId,
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `تم الإسناد إلى ${person.user.name}`,
    });
  } catch (error) {
    console.error("Assign PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}