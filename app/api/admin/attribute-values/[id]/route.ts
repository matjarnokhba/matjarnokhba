import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

// ═══ PATCH: موافقة أو رفض ═══
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }
    if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const valueId = parseInt(id);
    const body = await request.json();

    const action = body.action; // "approve" | "reject"
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { success: false, message: "إجراء غير صحيح" },
        { status: 400 }
      );
    }

    if (action === "reject" && !reason) {
      return NextResponse.json(
        { success: false, message: "سبب الرفض مطلوب" },
        { status: 400 }
      );
    }

    const value = await prisma.categoryAttributeValue.findUnique({
      where: { id: valueId },
      include: {
        attribute: { select: { name: true } },
        seller: { select: { userId: true, storeName: true } },
      },
    });

    if (!value) {
      return NextResponse.json(
        { success: false, message: "القيمة غير موجودة" },
        { status: 404 }
      );
    }

    if (value.status !== "PENDING") {
      return NextResponse.json(
        { success: false, message: "القيمة ليست بانتظار المراجعة" },
        { status: 400 }
      );
    }

    // ═══ التحديث ═══
    await prisma.categoryAttributeValue.update({
      where: { id: valueId },
      data: {
        status: action === "approve" ? "APPROVED" : "REJECTED",
        reviewedAt: new Date(),
        reviewedById: current.user.id,
        rejectionReason: action === "reject" ? reason : null,
        isActive: action === "approve",
      },
    });

    // ═══ إشعار للتاجر ═══
    if (value.seller) {
      try {
        await prisma.notification.create({
          data: {
            userId: value.seller.userId,
            type: "SELLER_PRODUCT_NEEDS_REVIEW" as const,
            title:
              action === "approve"
                ? "✅ تمت الموافقة على القيمة"
                : "❌ تم رفض القيمة",
            message:
              action === "approve"
                ? `قيمة "${value.value}" لخاصية "${value.attribute.name}" تمت الموافقة عليها وأصبحت متاحة لمنتجاتك.`
                : `قيمة "${value.value}" لخاصية "${value.attribute.name}" رُفضت: ${reason}`,
            link: `/seller/products`,
            category: "PRODUCT",
            severity: action === "approve" ? "INFO" : "WARNING",
          },
        });
      } catch (notifErr) {
        console.error("Notification failed:", notifErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Attribute value PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}