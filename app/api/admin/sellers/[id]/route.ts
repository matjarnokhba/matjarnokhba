import { NextResponse } from "next/server";
import { z } from "zod";
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

const actionSchema = z.object({
  action: z.enum(["approve", "suspend", "activate", "close", "verify"]),
  note: z.string().trim().max(500).optional(),
});

// ═══════ GET — تفاصيل بائع ═══════
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
    const sellerId = parseInt(id);
    if (isNaN(sellerId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            products: { where: { deletedAt: null } },
            orders: true,
          },
        },
      },
    });

    if (!seller) {
      return NextResponse.json(
        { success: false, message: "البائع غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, seller });
  } catch (error) {
    console.error("Admin seller GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ PATCH — تحديث حالة البائع ═══════
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
    const sellerId = parseInt(id);
    if (isNaN(sellerId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "إجراء غير صحيح" },
        { status: 400 }
      );
    }

    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      include: { user: { select: { id: true } } },
    });
    if (!seller) {
      return NextResponse.json(
        { success: false, message: "البائع غير موجود" },
        { status: 404 }
      );
    }

    const action = parsed.data.action;
    let updateData: any = {};
    let notification: { title: string; message: string; type: any } | null = null;

    switch (action) {
      case "approve":
        updateData = { status: "ACTIVE", isVerified: true, verifiedAt: new Date(), verifiedById: auth.user.id };
        notification = {
          title: "تم تفعيل متجرك 🎉",
          message: `مرحباً ${seller.storeName}! تمت الموافقة على متجرك. يمكنك الآن إضافة منتجاتك وبيعها.`,
          type: "SELLER_VERIFIED",
        };
        break;

      case "suspend":
        updateData = { status: "SUSPENDED" };
        notification = {
          title: "تم تعليق متجرك",
          message: "تم تعليق متجرك مؤقتاً من الإدارة. تواصل معنا للاستفسار.",
          type: "SELLER_SUSPENDED",
        };
        break;

      case "activate":
        updateData = { status: "ACTIVE" };
        notification = {
          title: "تم تفعيل متجرك",
          message: "متجرك يعمل الآن بشكل طبيعي.",
          type: "SELLER_VERIFIED",
        };
        break;

      case "close":
        updateData = { status: "CLOSED" };
        notification = {
          title: "تم إغلاق متجرك",
          message: "تم إغلاق متجرك نهائياً.",
          type: "SELLER_SUSPENDED",
        };
        break;

      case "verify":
        updateData = { isVerified: true, verifiedAt: new Date(), verifiedById: auth.user.id };
        notification = {
          title: "متجرك موثّق ✓",
          message: "أصبح متجرك موثّقاً الآن. ستظهر علامة التوثيق للعملاء.",
          type: "SELLER_VERIFIED",
        };
        break;
    }

    await prisma.$transaction(async (tx) => {
      await tx.seller.update({
        where: { id: sellerId },
        data: updateData,
      });

      // إشعار للتاجر
      if (notification && seller.user) {
        await tx.notification.create({
          data: {
            userId: seller.user.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            link: "/seller",
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin seller PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}