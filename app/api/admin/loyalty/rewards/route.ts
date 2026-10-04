import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "PENDING";

    // ═══ شرط أساسي: المكافآت PENDING تظهر فقط إن اختار العميل فئتها ═══
    const where: any = { status: status as any };

    if (status === "PENDING") {
      where.categoryId = { not: null };
    }

    const rewards = await prisma.loyaltyReward.findMany({
      where,
      include: {
        account: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
        tier: true,
        category: true,
        giftProduct: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // ═══ قائمة انتظار اختيار العميل (لأدمن — معلوماتية فقط) ═══
    const waitingCount = await prisma.loyaltyReward.count({
      where: { status: "PENDING", categoryId: null },
    });

    return NextResponse.json({
      success: true,
      waitingForCustomer: waitingCount,
      rewards: rewards.map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        accountId: r.accountId,
        customer: {
          id: r.account.user.id,
          name: r.account.user.name,
          email: r.account.user.email,
          phone: r.account.user.phone,
        },
        balance: r.account.balance,
        tier: {
          id: r.tier.id,
          name: r.tier.name,
          icon: r.tier.icon,
          requiredPoints: r.tier.requiredPoints,
        },
        category: r.category
          ? {
              id: r.category.id,
              name: r.category.name,
              icon: r.category.icon,
            }
          : null,
        giftProduct: r.giftProduct
          ? {
              id: r.giftProduct.id,
              name: r.giftProduct.name,
              imageUrl: r.giftProduct.imageUrl,
              costPrice: Number(r.giftProduct.costPrice),
            }
          : null,
        adminNote: r.adminNote,
        deliveredAt: r.deliveredAt,
      })),
    });
  } catch (error) {
    console.error("Admin rewards GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}