import { NextResponse } from "next/server";
import { z } from "zod";
import { SessionService } from "@/services/session.service";
import { ReviewService } from "@/services/review.service";

const createSchema = z.object({
  orderItemId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

// ═══════ POST — إنشاء مراجعة ═══════
export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const review = await ReviewService.create(current.user.id, parsed.data);

    return NextResponse.json({ success: true, review }, { status: 201 });
  } catch (error) {
    console.error("Review POST error:", error);
    const message = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}

// ═══════ GET — جلب مراجعات ═══════
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderIdParam = searchParams.get("orderId");
    const productIdParam = searchParams.get("productId");

    // ─── مراجعات منتج (عام — لا يحتاج تسجيل دخول) ───
    if (productIdParam) {
      const productId = parseInt(productIdParam);
      if (isNaN(productId)) {
        return NextResponse.json(
          { success: false, message: "معرف المنتج غير صحيح" },
          { status: 400 }
        );
      }

      const reviews = await ReviewService.getByProduct(productId);
      return NextResponse.json({ success: true, reviews });
    }

    // ─── مراجعات طلب (يحتاج تسجيل دخول) ───
    if (orderIdParam) {
      const current = await SessionService.getCurrent();
      if (!current) {
        return NextResponse.json(
          { success: false, message: "يجب تسجيل الدخول" },
          { status: 401 }
        );
      }

      const orderId = parseInt(orderIdParam);
      if (isNaN(orderId)) {
        return NextResponse.json(
          { success: false, message: "معرف الطلب غير صحيح" },
          { status: 400 }
        );
      }

      const reviews = await ReviewService.getByOrder(orderId, current.user.id);
      return NextResponse.json({ success: true, reviews });
    }

    return NextResponse.json(
      { success: false, message: "معامل غير صحيح" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Review GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}