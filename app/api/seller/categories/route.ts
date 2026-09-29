import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    if (!current.user.seller) {
      return NextResponse.json(
        { success: false, message: "ليس لديك متجر" },
        { status: 403 }
      );
    }

    const categories = await prisma.category.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ success: true, categories });
  } catch (error) {
    console.error("Seller categories GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}