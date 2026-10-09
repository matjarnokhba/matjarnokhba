import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { PermissionService, PERMISSIONS } from "@/services/permission.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    const canView = await PermissionService.hasPermission(
      current.user.id,
      PERMISSIONS.VIEW_WAREHOUSE
    );
    if (!canView) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const fulfillmentItemId = parseInt(id);
    if (isNaN(fulfillmentItemId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const item = await prisma.fulfillmentItem.findUnique({
      where: { id: fulfillmentItemId },
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
                source: true,
                status: true,
                userId: true,
                customerSnapshot: true,
                shippingAddressSnapshot: true,
                createdAt: true,
              },
            },
            product: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        history: {
          orderBy: { createdAt: "desc" },
        },
        warehouseReceipts: {
          orderBy: { createdAt: "desc" },
        },
        collectionItems: {
          include: {
            assignment: {
              select: {
                id: true,
                assignmentNumber: true,
                deliveryPersonId: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, message: "العنصر غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      item: {
        id: item.id,
        status: item.status,
        quantity: item.quantity,
        deadline: item.deadline,
        preparedAt: item.preparedAt,
        readyAt: item.readyAt,
        collectedAt: item.collectedAt,
        departedAt: item.departedAt,
        warehouseReceivedAt: item.warehouseReceivedAt,
        verifiedAt: item.verifiedAt,
        notes: item.notes,
        createdAt: item.createdAt,
        seller: item.seller,
        order: {
          id: item.orderItem.order.id,
          orderNumber: item.orderItem.order.orderNumber,
          source: item.orderItem.order.source,
          status: item.orderItem.order.status,
          userId: item.orderItem.order.userId,
          createdAt: item.orderItem.order.createdAt,
          customerSnapshot: item.orderItem.order.customerSnapshot,
          shippingAddressSnapshot:
            item.orderItem.order.shippingAddressSnapshot,
        },
        orderItem: {
          id: item.orderItem.id,
          productName: item.orderItem.productName,
          variantName: item.orderItem.variantName,
          sku: item.orderItem.sku,
          imageUrl: item.orderItem.imageUrl,
          quantity: item.orderItem.quantity,
          unitPrice: Number(item.orderItem.unitPrice),
          total: Number(item.orderItem.total),
        },
        history: item.history.map((h) => ({
          id: h.id,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          note: h.note,
          createdAt: h.createdAt,
        })),
        receipts: item.warehouseReceipts.map((r) => ({
          id: r.id,
          receiptNumber: r.receiptNumber,
          quantity: r.quantity,
          status: r.status,
          receivedAt: r.receivedAt,
          verifiedAt: r.verifiedAt,
          damagedQuantity: r.damagedQuantity,
          rejectionReason: r.rejectionReason,
          notes: r.notes,
        })),
        collection: item.collectionItems[0]
          ? {
              assignmentId: item.collectionItems[0].assignment.id,
              assignmentNumber:
                item.collectionItems[0].assignment.assignmentNumber,
              collectedAt: item.collectionItems[0].collectedAt,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Warehouse item detail error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}