import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { OrderService } from "@/services/order.service";

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول أولاً" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // ═══ التحقق الأساسي (بدون أسعار) ═══
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, message: "السلة فارغة" },
        { status: 400 }
      );
    }

    // كل item يجب أن يحتوي فقط: productId, variantId, quantity
    for (const item of body.items) {
      if (
        typeof item.productId !== "number" ||
        typeof item.variantId !== "number" ||
        typeof item.quantity !== "number"
      ) {
        return NextResponse.json(
          { success: false, message: "بيانات المنتج غير صحيحة" },
          { status: 400 }
        );
      }
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

    // ═══ Server يحسب كل شيء ═══
    const orders = await OrderService.createOrder(current.user.id, {
      items: body.items.map((item: any) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
      couponCode: body.couponCode?.trim() || undefined,
      address: {
        fullName: addr.fullName.trim(),
        phone: addr.phone.trim(),
        city: addr.city.trim(),
        street: addr.street.trim(),
        postalCode: addr.postalCode?.trim() || undefined,
      },
      customer: {
        id: current.user.id,
        name: current.user.name,
        email: current.user.email,
      },
    });

    return NextResponse.json(
      { success: true, orders },
      { status: 201 }
    );
  } catch (error) {
    console.error("Order API error:", error);
    const message =
      error instanceof Error ? error.message : "حدث خطأ أثناء إنشاء الطلب";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
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