import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { OrderService } from "@/services/order.service";
import { IdempotencyService } from "@/lib/idempotency";
import { rateLimit, formatRetryAfter } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول أولاً" },
        { status: 401 }
      );
    }

    // ═══ Rate Limit: 5 طلبات/دقيقة لكل مستخدم ═══
    const limit = await rateLimit(`orders:${current.user.id}`, 5, 60 * 1000);
    if (!limit.success) {
      return NextResponse.json(
        {
          success: false,
          message: `طلبات كثيرة جداً. حاول بعد ${formatRetryAfter(
            limit.retryAfterMs
          )}`,
        },
        { status: 429 }
      );
    }

    const body = await request.json();

    // ═══ 1. التحقق من المدخلات أولاً ═══
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, message: "السلة فارغة" },
        { status: 400 }
      );
    }

    if (body.items.length > 50) {
      return NextResponse.json(
        { success: false, message: "عدد المنتجات كبير جداً" },
        { status: 400 }
      );
    }

    for (const item of body.items) {
      if (
        typeof item.productId !== "number" ||
        typeof item.variantId !== "number" ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0 ||
        item.quantity > 100
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

    // ═══ 2. Idempotency ═══
    const idempotencyKey =
      request.headers.get("Idempotency-Key") || body.idempotencyKey;

    if (
      !idempotencyKey ||
      typeof idempotencyKey !== "string" ||
      idempotencyKey.length < 8
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Idempotency-Key مطلوب (8 أحرف على الأقل)",
        },
        { status: 400 }
      );
    }

    const idem = await IdempotencyService.check(
      current.user.id,
      "POST:/api/orders",
      idempotencyKey,
      { items: body.items, address: addr, couponCode: body.couponCode }
    );

    if (idem.status === "cached") {
      return NextResponse.json(idem.response, { status: idem.statusCode });
    }
    if (idem.status === "conflict") {
      return NextResponse.json(
        { success: false, message: idem.message },
        { status: 409 }
      );
    }
    if (idem.status === "in_progress") {
      return NextResponse.json(
        { success: false, message: idem.message },
        { status: 429 }
      );
    }

    // idem.status === "new"
    try {
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
          postalCode:
            typeof addr.postalCode === "string"
              ? addr.postalCode.trim()
              : undefined,
        },
        customer: {
          id: current.user.id,
          name: current.user.name,
          email: current.user.email,
        },
      });

      const payload = { success: true, orders };
      await IdempotencyService.save(idem.id, payload, 201);
      return NextResponse.json(payload, { status: 201 });
    } catch (err) {
      await IdempotencyService.clear(idem.id);
      throw err;
    }
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