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

export async function GET(request: Request) {
  try {
    const auth = await requireWarehouse();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "ACTIVE";

    let where: any = {};

    if (status === "ACTIVE") {
      where.status = {
        in: [
          "PENDING_PICKUP",
          "PICKED_UP",
          "IN_TRANSIT_TO_WAREHOUSE",
          "RECEIVED_AT_WAREHOUSE",
          "IN_TRANSIT_TO_SELLER",
          "DELIVERED_TO_SELLER",
        ],
      };
    } else if (status === "INSPECTED") {
      where.status = "INSPECTED";
    } else if (status === "COMPLETED") {
      where.status = "COMPLETED";
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
            items: {
              include: {
                orderItem: {
                  include: {
                    seller: { select: { storeName: true } },
                  },
                },
              },
            },
          },
        },
        returnDriver: {
          include: { user: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const serialized = JSON.parse(
      JSON.stringify(returns, (_, v) => {
        if (typeof v === "bigint") return v.toString();
        if (
          v !== null &&
          typeof v === "object" &&
          typeof v.toNumber === "function" &&
          typeof v.toFixed === "function"
        ) {
          return v.toNumber();
        }
        return v;
      })
    );

    return NextResponse.json({ success: true, returns: serialized });
  } catch (error) {
    console.error("Warehouse returns list error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}