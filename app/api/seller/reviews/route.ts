import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireSeller() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };
  return { user: current.user, seller: current.user.seller };
}

export async function GET(request: Request) {
  try {
    const auth = await requireSeller();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "ALL"; // ALL | APPROVED | PENDING
    const search = searchParams.get("q")?.trim() || "";
    const rating = searchParams.get("rating") || "ALL";

    const where: any = {
      product: {
        sellerId: auth.seller.id,
        deletedAt: null,
      },
      deletedAt: null,
    };

    if (filter === "APPROVED") where.isApproved = true;
    if (filter === "PENDING") where.isApproved = false;
    if (rating !== "ALL") where.rating = parseInt(rating);

    if (search) {
      where.OR = [
        { comment: { contains: search, mode: "insensitive" } },
        { product: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [reviews, stats] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: { select: { name: true } },
          product: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.review.groupBy({
        by: ["rating"],
        where: {
          product: {
            sellerId: auth.seller.id,
            deletedAt: null,
          },
          deletedAt: null,
          isApproved: true,
        },
        _count: true,
      }),
    ]);

    // إحصائيات
    const statsMap: any = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, total: 0, avg: 0 };
    let totalRating = 0;
    for (const s of stats) {
      statsMap[s.rating] = s._count;
      statsMap.total += s._count;
      totalRating += s.rating * s._count;
    }
    statsMap.avg = statsMap.total > 0 ? totalRating / statsMap.total : 0;

    return NextResponse.json({ success: true, reviews, stats: statsMap });
  } catch (error) {
    console.error("Seller reviews GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}