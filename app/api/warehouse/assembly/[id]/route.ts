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

    const assembly = await prisma.assemblyFile.findUnique({
      where: { id: assemblyId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerSnapshot: true,
            shippingAddressSnapshot: true,
            total: true,
            items: {
              select: {
                id: true,
                productName: true,
                variantName: true,
                imageUrl: true,
                quantity: true,
                total: true,
                sellerId: true,
                fulfillmentItems: {
                  select: { id: true, status: true, sellerId: true },
                },
              },
            },
          },
        },
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
                    productName: true,
                    variantName: true,
                    imageUrl: true,
                    sku: true,
                    quantity: true,
                    unitPrice: true,
                    total: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!assembly) {
      return NextResponse.json(
        { success: false, message: "ملف التجميع غير موجود" },
        { status: 404 }
      );
    }

    // ═══ طلبات العميل الأخرى ═══
    const customerOtherOrders = await prisma.order.findMany({
      where: {
        userId: assembly.userId,
        id: { not: assembly.orderId },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        assemblyFile: {
          select: {
            id: true,
            assemblyCode: true,
            status: true,
            expectedItems: true,
            receivedItems: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const combined = {
      ...assembly,
      customerOtherOrders,
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