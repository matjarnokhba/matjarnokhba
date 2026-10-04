import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const rewardId = parseInt(id);
    const body = await request.json();
    const categoryId = parseInt(body.categoryId);

    if (!categoryId || isNaN(categoryId)) {
      return NextResponse.json(
        { success: false, message: "الفئة مطلوبة" },
        { status: 400 }
      );
    }

    const account = await prisma.loyaltyAccount.findUnique({
      where: { userId: current.user.id },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, message: "لا يوجد حساب ولاء" },
        { status: 404 }
      );
    }

    const reward = await prisma.loyaltyReward.findFirst({
      where: { id: rewardId, accountId: account.id },
      include: { tier: true },
    });

    if (!reward) {
      return NextResponse.json(
        { success: false, message: "المكافأة غير موجودة" },
        { status: 404 }
      );
    }

    if (reward.status !== "PENDING") {
      return NextResponse.json(
        { success: false, message: "لا يمكن تعديل هذه المكافأة" },
        { status: 400 }
      );
    }

    if (reward.categoryId) {
      return NextResponse.json(
        {
          success: false,
          message: "سبق أن اخترت فئة لهذه المكافأة",
        },
        { status: 400 }
      );
    }

    const category = await prisma.loyaltyRewardCategory.findUnique({
      where: { id: categoryId, isActive: true },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, message: "الفئة غير متاحة" },
        { status: 400 }
      );
    }

    // ═══ التحديث ═══
    await prisma.loyaltyReward.update({
      where: { id: rewardId },
      data: { categoryId },
    });

    // ═══ إشعار الأدمن — الآن فقط يصبح جاهزاً ═══
    try {
      const admins = await prisma.user.findMany({
        where: {
          role: { in: ["ADMIN", "SUPER_ADMIN"] },
          deletedAt: null,
        },
        select: { id: true },
      });

      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            type: "SELLER_PRODUCT_NEEDS_REVIEW" as const,
            title: "🎁 مكافأة ولاء جاهزة",
            message: `العميل "${current.user.name}" اختار فئة "${category.name}" لمكافأة ${reward.tier.icon || "🎁"} ${reward.tier.name}. جاهزة للتعيين.`,
            link: `/admin/loyalty`,
            category: "ORDER",
            severity: "INFO",
            metadata: {
              rewardId,
              customerId: current.user.id,
              customerName: current.user.name,
              tierName: reward.tier.name,
              categoryName: category.name,
            },
          })),
        });
      }
    } catch (notifErr) {
      console.error("Admin notification failed:", notifErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Loyalty reward category error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}