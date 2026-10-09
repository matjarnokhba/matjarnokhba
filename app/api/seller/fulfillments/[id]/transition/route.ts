import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { FulfillmentService } from "@/services/fulfillment.service";

async function requireSellerOwnership(fulfillmentItemId: number) {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };

  const item = await prisma.fulfillmentItem.findUnique({
    where: { id: fulfillmentItemId },
    select: {
      id: true,
      sellerId: true,
      status: true,
      orderItemId: true,
    },
  });

  if (!item) {
    return { error: "العنصر غير موجود", status: 404 };
  }

  if (item.sellerId !== current.user.seller.id) {
    return { error: "هذا العنصر لا يخص متجرك", status: 403 };
  }

  return { user: current.user, item };
}

const transitionSchema = z.object({
  toStatus: z.enum(["PREPARING", "READY_FOR_COLLECTION"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fulfillmentItemId = parseInt(id);
    if (isNaN(fulfillmentItemId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const auth = await requireSellerOwnership(fulfillmentItemId);
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const parsed = transitionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // ═══ Transition عبر الخدمة (تحتوي كل الحمايات) ═══
    const result = await FulfillmentService.transition({
      fulfillmentItemId,
      toStatus: data.toStatus,
      changedById: auth.user.id,
      note: data.note || undefined,
    });

    return NextResponse.json({
      success: true,
      fromStatus: result.fromStatus,
      toStatus: result.toStatus,
    });
  } catch (error) {
    console.error("Fulfillment transition error:", error);
    const message =
      error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}