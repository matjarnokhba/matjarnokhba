import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { FulfillmentService } from "@/services/fulfillment.service";
import { isUploadThingUrl } from "@/lib/upload-url";

async function requireSellerOwnership(fulfillmentItemId: number) {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };
  if (current.user.seller.status === "SUSPENDED" || current.user.seller.status === "CLOSED") {
    return { error: "متجرك معطّل. تواصل مع الإدارة.", status: 403 };
  }

  // M12 — فرض صلاحية MANAGE_FULFILLMENTS على الموظفين
  if (!current.user.isSellerOwner && !current.user.staffPermissions.includes("MANAGE_FULFILLMENTS")) {
    return { error: "لا تملك صلاحية إدارة التجهيزات", status: 403 };
  }

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
  photoUrls: z.array(z.string().url().max(500).refine(isUploadThingUrl, "رابط صورة غير صالح")).max(5).optional().default([]),
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
    // ═══ صور التجهيز: اختيارية افتراضياً، وتصبح إلزامية إذا فعّل الأدمن السياسة PREP_PHOTO_REQUIRED ═══
    if (data.toStatus === "READY_FOR_COLLECTION" && data.photoUrls.length === 0) {
      const photoPolicy = await prisma.systemPolicy.findUnique({ where: { key: "PREP_PHOTO_REQUIRED" } });
      if (photoPolicy?.value === true) {
        return NextResponse.json(
          { success: false, message: "أضف صورة واحدة على الأقل للطرد قبل تأكيد الجاهزية" },
          { status: 400 }
        );
      }
    }

    const result = await FulfillmentService.transition({
      fulfillmentItemId,
      toStatus: data.toStatus,
      changedById: auth.user.id,
      note: data.note || undefined,
      readyPhotoUrls: data.toStatus === "READY_FOR_COLLECTION" ? data.photoUrls : undefined,
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