import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { OrderService } from "@/services/order.service";

export async function POST(request: Request) {
  try {
    // ═══════ التحقق من الجلسة ═══════
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول أولاً" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // ═══════ التحقق من البيانات ═══════
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, message: "السلة فارغة" },
        { status: 400 }
      );
    }

    const addr = body.address;
    if (
      !addr?.fullName?.trim() ||
      !addr?.phone?.trim() ||
      !addr?.city?.trim() ||
      !addr?.street?.trim()
    ) {
      return NextResponse.json(
        { success: false, message: "جميع حقول العنوان مطلوبة" },
        { status: 400 }
      );
    }

    // ═══════ إنشاء الطلب ═══════
    const order = await OrderService.createOrder(current.user.id, {
      items: body.items.map((item: any) => ({
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku || "N/A",
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      subtotal: body.subtotal,
      shippingCost: body.shippingCost,
      total: body.total,
      discount: body.discount ?? 0,
      couponId: body.couponId,
      address: {
        fullName: addr.fullName,
        phone: addr.phone,
        city: addr.city,
        street: addr.street,
        postalCode: addr.postalCode || undefined,
      },
      customer: {
        id: current.user.id,
        name: current.user.name,
        email: current.user.email,
      },
    });

    return NextResponse.json(
      { success: true, order: { id: order.id, orderNumber: order.orderNumber } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Order API error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء إنشاء الطلب" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    const orders = await OrderService.getByUser(current.user.id);
    return NextResponse.json({ success: true, orders });
  } catch (error) {
    console.error("Orders GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}