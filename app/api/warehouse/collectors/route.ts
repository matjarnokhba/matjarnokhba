import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireWarehouse() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const allowed = ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }

  return { user: current.user };
}

export async function GET() {
  try {
    const auth = await requireWarehouse();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const collectors = await prisma.user.findMany({
      where: {
        role: "COLLECTOR",
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
      orderBy: { name: "asc" },
    });

    // ═══ عدد المهام النشطة لكل جامع ═══
    const withCounts = await Promise.all(
      collectors.map(async (c) => {
        const activeCount = await prisma.fulfillmentItem.count({
          where: {
            assignedCollectorId: c.id,
            status: {
              in: ["READY_FOR_COLLECTION", "COLLECTED"],
            },
          },
        });
        return { ...c, activeCount };
      })
    );

    return NextResponse.json({
      success: true,
      collectors: withCounts,
    });
  } catch (error) {
    console.error("Collectors list error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}