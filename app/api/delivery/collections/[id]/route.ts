import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireDelivery() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "DELIVERY") {
    return { error: "غير مصرح", status: 403 };
  }

  const person = await prisma.deliveryPerson.findUnique({
    where: { userId: current.user.id },
    select: { id: true, status: true, deletedAt: true },
  });

  if (!person || person.deletedAt || person.status !== "ACTIVE") {
    return { error: "الحساب غير نشط", status: 403 };
  }

  return { user: current.user, person };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireDelivery();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const assignmentId = parseInt(id);
    if (isNaN(assignmentId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const assignment = await prisma.collectionAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        items: {
          include: {
            fulfillmentItem: {
              include: {
                seller: {
                  select: {
                    id: true,
                    storeName: true,
                    slug: true,
                    city: true,
                    region: true,
                  },
                },
                orderItem: {
                  include: {
                    order: {
                      select: {
                        id: true,
                        orderNumber: true,
                        createdAt: true,
                      },
                    },
                    product: {
                      select: { id: true, name: true, slug: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, message: "التكليف غير موجود" },
        { status: 404 }
      );
    }

    if (assignment.deliveryPersonId !== auth.person.id) {
      return NextResponse.json(
        { success: false, message: "هذا التكليف ليس مُسنداً إليك" },
        { status: 403 }
      );
    }

    // ═══ تجميع العناصر حسب التاجر ═══
    const sellerMap = new Map<
      number,
      {
        sellerId: number;
        sellerName: string;
        sellerSlug: string;
        city: string | null;
        region: string | null;
        items: any[];
      }
    >();

    for (const item of assignment.items) {
      const seller = item.fulfillmentItem.seller;
      if (!sellerMap.has(seller.id)) {
        sellerMap.set(seller.id, {
          sellerId: seller.id,
          sellerName: seller.storeName,
          sellerSlug: seller.slug,
          city: seller.city,
          region: seller.region,
          items: [],
        });
      }

      sellerMap.get(seller.id)!.items.push({
        id: item.id,
        fulfillmentItemId: item.fulfillmentItemId,
        orderId: item.fulfillmentItem.orderItem.order.id,
        orderNumber: item.fulfillmentItem.orderItem.order.orderNumber,
        productName: item.fulfillmentItem.orderItem.productName,
        variantName: item.fulfillmentItem.orderItem.variantName,
        sku: item.fulfillmentItem.orderItem.sku,
        imageUrl: item.fulfillmentItem.orderItem.imageUrl,
        quantity: item.quantity,
        collectedAt: item.collectedAt,
        departedAt: item.fulfillmentItem.departedAt,
        fulfillmentStatus: item.fulfillmentItem.status,
      });
    }

    const totalCollected = assignment.items.filter((i) => i.collectedAt)
      .length;

    return NextResponse.json({
      success: true,
      assignment: {
        id: assignment.id,
        assignmentNumber: assignment.assignmentNumber,
        status: assignment.status,
        scheduledAt: assignment.scheduledAt,
        startedAt: assignment.startedAt,
        completedAt: assignment.completedAt,
        cancelledAt: assignment.cancelledAt,
        cancelReason: assignment.cancelReason,
        notes: assignment.notes,
        createdAt: assignment.createdAt,
        itemsCount: assignment.items.length,
        collectedCount: totalCollected,
        sellers: Array.from(sellerMap.values()),
      },
    });
  } catch (error) {
    console.error("Delivery collection detail error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}