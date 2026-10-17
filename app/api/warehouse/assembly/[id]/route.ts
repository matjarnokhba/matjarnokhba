import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { AssemblyService } from "@/services/assembly.service";

async function requireWarehouse() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  const allowed = ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireWarehouse();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const assemblyId = parseInt(id);
    if (isNaN(assemblyId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    // ═══ Lazy recompute ═══
    await prisma.$transaction(async (tx) => {
      await AssemblyService.recompute(tx, assemblyId);
    });

    const rawAssembly = await prisma.assemblyFile.findUnique({
      where: { id: assemblyId },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        items: {
          include: {
            fulfillmentItem: {
              select: {
                id: true,
                status: true,
                quantity: true,
                sellerId: true,
                seller: { select: { id: true, storeName: true, city: true } },
                orderItem: {
                  select: {
                    id: true,
                    orderId: true,
                    productName: true,
                    variantName: true,
                    imageUrl: true,
                    sku: true,
                    quantity: true,
                    unitPrice: true,
                    total: true,
                    order: {
                      select: {
                        id: true,
                        orderNumber: true,
                        shippingAddressSnapshot: true,
                        customerSnapshot: true,
                        total: true,
                        createdAt: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!rawAssembly) {
      return NextResponse.json(
        { success: false, message: "ملف التجميع غير موجود" },
        { status: 404 }
      );
    }

    const assembly: any = rawAssembly;

    // ═══ الشحنات المنشأة من هذا الملف ═══
    const shipmentIdSet = new Set<number>();
    for (const ai of assembly.items) {
      if (typeof ai.shipmentId === "number" && ai.shipmentId > 0) {
        shipmentIdSet.add(ai.shipmentId);
      }
    }
    const shipmentIds = Array.from(shipmentIdSet);

    const shipments =
      shipmentIds.length > 0
        ? await prisma.shipment.findMany({
            where: { id: { in: shipmentIds } },
            select: {
              id: true,
              shipmentNumber: true,
              status: true,
              totalCOD: true,
              totalOrders: true,
              createdAt: true,
              assignedAt: true,
              _count: { select: { items: true } },
            },
            orderBy: { createdAt: "desc" },
          })
        : [];

    // ═══ تجميع الطلبات الفريدة ═══
    const orderMap = new Map<
      number,
      {
        id: number;
        orderNumber: string;
        createdAt: Date;
        total: number;
        items: any[];
        status: "READY" | "PARTIAL" | "PENDING" | "COMPLETED";
      }
    >();

    for (const ai of assembly.items) {
      const oi = ai.fulfillmentItem.orderItem;
      const o = oi.order;
      if (!orderMap.has(o.id)) {
        orderMap.set(o.id, {
          id: o.id,
          orderNumber: o.orderNumber,
          createdAt: o.createdAt,
          total: Number(o.total),
          items: [],
          status: "PENDING",
        });
      }
      const entry = orderMap.get(o.id)!;
      entry.items.push({
        assemblyItemId: ai.id,
        fulfillmentItemId: ai.fulfillmentItem.id,
        status: ai.fulfillmentItem.status,
        includedInShipment: ai.includedInShipment,
        receivedAt: ai.receivedAt,
        productName: oi.productName,
        variantName: oi.variantName,
        imageUrl: oi.imageUrl,
        quantity: oi.quantity,
        total: Number(oi.total),
        seller: ai.fulfillmentItem.seller,
      });
    }

    // ═══ حساب حالة كل طلب ═══
    for (const [_, entry] of orderMap) {
      const all = entry.items;
      const allShipped = all.every((i) => i.includedInShipment);
      const allReceived = all.every((i) => i.receivedAt !== null);

      if (allShipped) entry.status = "COMPLETED";
      else if (allReceived) entry.status = "READY";
      else if (all.some((i) => i.receivedAt)) entry.status = "PARTIAL";
      else entry.status = "PENDING";
    }

    const orders = Array.from(orderMap.values()).sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // ═══ العنوان — من أحدث طلب ═══
    const latestAddr = (assembly.items[assembly.items.length - 1]
      ?.fulfillmentItem?.orderItem?.order
      ?.shippingAddressSnapshot || {}) as any;

    const combined = {
      ...assembly,
      orders,
      shipments,
      shippingAddress: latestAddr,
    };

    const serialized = JSON.parse(
      JSON.stringify(combined, (_, v) => {
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

    return NextResponse.json({ success: true, assembly: serialized });
  } catch (error) {
    console.error("Assembly detail error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}