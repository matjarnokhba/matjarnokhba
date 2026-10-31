import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !["ADMIN", "SUPER_ADMIN"].includes(current.user.role)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "unverified";

    const where =
      status === "verified"
        ? { claimVerified: true, deletedAt: null }
        : { claimVerified: false, isActive: true, deletedAt: null };

    const items = await prisma.sellerOffer.findMany({
      where,
      take: 100,
      orderBy: { createdAt: "desc" },
      include: {
        master: {
          select: { id: true, name: true, brand: true, images: true, barcode: true, isVerified: true },
        },
        supplier: {
          select: { id: true, displayName: true, isVerified: true, activityType: true, city: true },
        },
        source: { select: { id: true, name: true, city: true } },
      },
    });

    return NextResponse.json({ success: true, items, status });
  } catch (error) {
    console.error("Admin claims list error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}