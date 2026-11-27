import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLogisticsPlatform } from "@/lib/logistics-guards";
import { logisticsErrorResponse } from "@/lib/logistics-route";

export async function GET(request: Request) {
  try {
    const g = await requireLogisticsPlatform();
    if (!g.ok) return g.response;
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ success: true, users: [] });
    const users = await prisma.user.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] },
      select: { id: true, name: true, phone: true, role: true },
      orderBy: { id: "desc" },
      take: 10,
    });
    return NextResponse.json({ success: true, users });
  } catch (e) {
    return logisticsErrorResponse(e);
  }
}