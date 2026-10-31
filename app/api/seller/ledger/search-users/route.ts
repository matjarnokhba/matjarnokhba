import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    if (q.length < 2) return NextResponse.json({ success: true, users: [] });

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        id: { not: current.user.id },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      },
      take: 10,
      select: { id: true, name: true, email: true, phone: true },
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("Search users error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}