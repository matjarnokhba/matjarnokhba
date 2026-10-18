import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { ReturnShipmentService } from "@/services/return-shipment.service";

async function requireCollector() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  const allowed = ["COLLECTOR", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

export async function GET(request: Request) {
  try {
    const auth = await requireCollector();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "PENDING";

    const where: any = {};
    if (status === "PENDING") {
      where.status = "PENDING_PICKUP";
    } else if (status === "PICKED_UP") {
      where.status = { in: ["PICKED_UP", "IN_TRANSIT_TO_WAREHOUSE"] };
    } else if (status !== "ALL") {
      where.status = status;
    }

    const returns = await prisma.returnShipment.findMany({
      where,
      include: {
        returnRequest: {
          include: {
            order: { select: { id: true, orderNumber: true } },
            user: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    const serialized = await Promise.all(
      returns.map(async (r) => {
        let pickupRawToken: string | null = null;
        if (!r.pickupTokenRevokedAt) {
          try {
            pickupRawToken = ReturnShipmentService.decryptToken(
              r.pickupTokenEncrypted
            );
          } catch {}
        }
        return {
          id: r.id,
          returnNumber: r.returnNumber,
          status: r.status,
          pickupTokenPreview: r.pickupTokenPreview,
          pickupRawToken,
          returnRequest: r.returnRequest,
        };
      })
    );

    return NextResponse.json({ success: true, returns: serialized });
  } catch (error) {
    console.error("Collector returns list error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}