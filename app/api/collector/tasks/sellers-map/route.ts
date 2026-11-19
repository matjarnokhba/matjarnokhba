import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireCollector() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  const allowed = ["COLLECTOR", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

export async function GET() {
  try {
    const auth = await requireCollector();
    if ("error" in auth) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const items = await prisma.fulfillmentItem.findMany({
      where: {
        assignedCollectorId: auth.user.id,
        status: { in: ["READY_FOR_COLLECTION", "COLLECTED"] },
        seller: { latitude: { not: null }, longitude: { not: null } },
      },
      select: {
        seller: {
          select: {
            id: true,
            storeName: true,
            city: true,
            slug: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    const seen = new Map<number, {
      id: number;
      storeName: string;
      city: string | null;
      slug: string;
      latitude: number;
      longitude: number;
    }>();

    for (const item of items) {
      const s = item.seller;
      if (s.latitude == null || s.longitude == null) continue;
      if (!seen.has(s.id)) {
        seen.set(s.id, {
          id: s.id,
          storeName: s.storeName,
          city: s.city,
          slug: s.slug,
          latitude: s.latitude,
          longitude: s.longitude,
        });
      }
    }

    const sellers = Array.from(seen.values());

    const totalAssignedRaw = await prisma.fulfillmentItem.findMany({
      where: {
        assignedCollectorId: auth.user.id,
        status: { in: ["READY_FOR_COLLECTION", "COLLECTED"] },
      },
      select: { sellerId: true },
    });
    const totalAssigned = new Set(totalAssignedRaw.map((i) => i.sellerId)).size;

    return NextResponse.json({
      success: true,
      sellers,
      totalAssigned,
      withoutLocation: totalAssigned - sellers.length,
    });
  } catch (error) {
    console.error("collector sellers-map error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}