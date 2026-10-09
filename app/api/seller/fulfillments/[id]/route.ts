import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireSellerOwnership(fulfillmentItemId: number) {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };

  const item = await prisma.fulfillmentItem.findUnique({
    where: { id: fulfillmentItemId },
    include: {
      seller: { select: { id: true, storeName: true, slug: true } },
      orderItem: {
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              source: true,
              status: true,
              createdAt: true,
              customerSnapshot: true,
              shippingAddressSnapshot: true,
            },
          },
          product: { select: { id: true, name: true, slug: true } },
        },
      },
      history: { orderBy: { createdAt: "desc" } },
      warehouseReceipts: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!item) return { error: "العنصر غير موجود", status: 404 };
  if (item.sellerId !== current.user.seller.id) {
    return { error: "غير مصرح", status: 403 };
  }

  return { user: current.user, item };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fulfillmentItemId = parseInt(id);
    if (isNaN(fulfillmentItemId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const auth = await requireSellerOwnership(fulfillmentItemId);
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    return NextResponse.json({
      success: true,
      fulfillment: auth.item,
    });
  } catch (error) {
    console.error("Fulfillment detail error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}