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

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "PENDING";
    const search = searchParams.get("q")?.trim() || "";

    const where: any = { deletedAt: null };
    if (status !== "ALL") where.verificationStatus = status;

    if (search) {
      where.OR = [
        { bankName: { contains: search, mode: "insensitive" } },
        { accountHolderMasked: { contains: search, mode: "insensitive" } },
        { businessName: { contains: search, mode: "insensitive" } },
        { seller: { storeName: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [accounts, stats] = await Promise.all([
      prisma.sellerBankAccount.findMany({
        where,
        include: {
          seller: {
            select: {
              id: true,
              storeName: true,
              slug: true,
              isVerified: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.sellerBankAccount.groupBy({
        by: ["verificationStatus"],
        where: { deletedAt: null },
        _count: true,
      }),
    ]);

    const statsMap: any = { PENDING: 0, VERIFIED: 0, REJECTED: 0, total: 0 };
    for (const s of stats) {
      statsMap[s.verificationStatus] = s._count;
      statsMap.total += s._count;
    }

    const formatted = accounts.map((a) => ({
      id: a.id,
      bankName: a.bankName,
      accountHolderMasked: a.accountHolderMasked,
      ibanMasked: a.ibanMasked,
      ribMasked: a.ribMasked,
      businessName: a.businessName,
      accountType: a.accountType,
      currency: a.currency,
      verificationStatus: a.verificationStatus,
      verifiedAt: a.verifiedAt,
      rejectionReason: a.rejectionReason,
      isDefault: a.isDefault,
      isActive: a.isActive,
      createdAt: a.createdAt,
      seller: a.seller,
    }));

    return NextResponse.json({
      success: true,
      accounts: formatted,
      stats: statsMap,
    });
  } catch (error) {
    console.error("Admin bank accounts GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}