import { NextResponse } from "next/server";
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

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    let settings = await prisma.loyaltySettings.findUnique({
      where: { id: 1 },
    });

    if (!settings) {
      settings = await prisma.loyaltySettings.create({
        data: {
          id: 1,
          isEnabled: true,
          pointsPer100DH: 5,
          description: "",
        },
      });
    }

    const tiers = await prisma.loyaltyTier.findMany({
      where: { isActive: true },
      orderBy: { requiredPoints: "asc" },
      include: { _count: { select: { giftProducts: true } } },
    });

    const categories = await prisma.loyaltyRewardCategory.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      include: { _count: { select: { giftProducts: true } } },
    });

    // إحصائيات
    const [totalAccounts, totalRewards, pendingRewards, pointsAggregate] =
      await Promise.all([
        prisma.loyaltyAccount.count(),
        prisma.loyaltyReward.count(),
        prisma.loyaltyReward.count({ where: { status: "PENDING" } }),
        prisma.loyaltyAccount.aggregate({
          _sum: { totalEarned: true },
        }),
      ]);

    return NextResponse.json({
      success: true,
      settings,
      tiers: tiers.map((t) => ({
        ...t,
        giftProductsCount: t._count.giftProducts,
      })),
      categories: categories.map((c) => ({
        ...c,
        giftProductsCount: c._count.giftProducts,
      })),
      stats: {
        totalAccounts,
        totalRewards,
        pendingRewards,
        totalPointsIssued: pointsAggregate._sum.totalEarned || 0,
      },
    });
  } catch (error) {
    console.error("Admin loyalty settings GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const updates: any = {};

    if (typeof body.isEnabled === "boolean") {
      updates.isEnabled = body.isEnabled;
    }
    if (typeof body.description === "string") {
      updates.description = body.description.trim();
    }
    if (
      typeof body.pointsPer100DH === "number" &&
      body.pointsPer100DH > 0 &&
      body.pointsPer100DH <= 100
    ) {
      updates.pointsPer100DH = body.pointsPer100DH;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد تغييرات" },
        { status: 400 }
      );
    }

    await prisma.loyaltySettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        isEnabled: updates.isEnabled ?? true,
        pointsPer100DH: updates.pointsPer100DH ?? 5,
        description: updates.description ?? "",
      },
      update: updates,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin loyalty settings PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}