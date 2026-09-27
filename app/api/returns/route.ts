import { NextResponse } from "next/server";
import { z } from "zod";
import { SessionService } from "@/services/session.service";
import { ReturnService } from "@/services/return.service";

const createSchema = z.object({
  orderId: z.number().int().positive(),
  reason: z.string().trim().min(5, "سبب الإرجاع يجب أن يكون 5 أحرف على الأقل").max(500),
  items: z
    .array(
      z.object({
        orderItemId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, "اختر منتجاً واحداً على الأقل"),
});

// ═══════ POST — إنشاء طلب إرجاع ═══════
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

    const returnRequest = await ReturnService.create(
      current.user.id,
      parsed.data
    );

    return NextResponse.json(
      {
        success: true,
        returnRequest: {
          id: returnRequest.id,
          status: returnRequest.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Return create error:", error);
    const message = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}

// ═══════ GET — طلبات الإرجاع للعميل ═══════
export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const orderIdParam = searchParams.get("orderId");

    if (!orderIdParam) {
      return NextResponse.json(
        { success: false, message: "orderId مطلوب" },
        { status: 400 }
      );
    }

    const orderId = parseInt(orderIdParam);
    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, message: "orderId غير صحيح" },
        { status: 400 }
      );
    }

    const returns = await ReturnService.getByOrder(orderId, current.user.id);
    return NextResponse.json({ success: true, returns });
  } catch (error) {
    console.error("Returns GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}