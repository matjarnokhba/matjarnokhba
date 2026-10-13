import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { ReturnShipmentService } from "@/services/return-shipment.service";

async function requireSeller() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) {
    return { error: "ليس لديك متجر", status: 403 };
  }
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
    const status = searchParams.get("status") || "ACTIVE";

    let statusFilter: any;
    if (status === "ACTIVE") {
      statusFilter = {
        in: [
          "INSPECTED",
          "IN_TRANSIT_TO_SELLER",
          "DELIVERED_TO_SELLER",
        ],
      };
    } else if (status === "COMPLETED") {
      statusFilter = "COMPLETED";
    } else if (status === "ALL") {
      statusFilter = undefined;
    } else {
      statusFilter = status;
    }

    // ═══ المرتجعات التي تحتوي على منتجات هذا التاجر ═══
    const returns = await prisma.returnShipment.findMany({
      where: {
        ...(statusFilter && { status: statusFilter }),
        returnRequest: {
          items: {
            some: {
              orderItem: {
                sellerId: auth.seller.id,
              },
            },
          },
        },
      },
      include: {
        returnRequest: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                customerSnapshot: true,
              },
            },
            user: { select: { id: true, name: true, phone: true } },
            items: {
              where: {
                orderItem: { sellerId: auth.seller.id },
              },
              include: {
                orderItem: {
                  select: {
                    id: true,
                    productName: true,
                    variantName: true,
                    imageUrl: true,
                    quantity: true,
                    unitPrice: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const serialized = await Promise.all(
      returns.map(async (r) => {
        let deliveryRawToken: string | null = null;
        if (!r.deliveryTokenRevokedAt) {
          try {
            deliveryRawToken = ReturnShipmentService.decryptToken(
              r.deliveryTokenEncrypted
            );
          } catch {}
        }

        return {
          id: r.id,
          returnNumber: r.returnNumber,
          status: r.status,
          inspectionStatus: r.inspectionStatus,
          inspectionNotes: r.inspectionNotes,
          sellerRejectionReason: r.sellerRejectionReason,
          createdAt: r.createdAt,
          inspectedAt: r.inspectedAt,
          returnAssignedAt: r.returnAssignedAt,
          deliveredToSellerAt: r.deliveredToSellerAt,
          sellerConfirmedAt: r.sellerConfirmedAt,
          deliveryTokenPreview: r.deliveryTokenPreview,
          deliveryRawToken,
          returnRequest: r.returnRequest,
        };
      })
    );

    // ═══ Stats ═══
    const allReturns = await prisma.returnShipment.findMany({
      where: {
        returnRequest: {
          items: {
            some: {
              orderItem: { sellerId: auth.seller.id },
            },
          },
        },
      },
      select: { status: true },
    });

    const stats = {
      pending: allReturns.filter(
        (r) => r.status === "INSPECTED" || r.status === "IN_TRANSIT_TO_SELLER"
      ).length,
      delivered: allReturns.filter((r) => r.status === "DELIVERED_TO_SELLER")
        .length,
      completed: allReturns.filter((r) => r.status === "COMPLETED").length,
      total: allReturns.length,
    };

    return NextResponse.json({
      success: true,
      returns: serialized,
      stats,
    });
  } catch (error) {
    console.error("Seller returns list error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}