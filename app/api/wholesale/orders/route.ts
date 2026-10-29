import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const itemSchema = z.object({
  offerId: z.number().int().positive(),
  offerVariantId: z.number().int().positive().nullable().optional(),
  qty: z.number().int().min(1),
});

const createSchema = z.object({
  items: z.array(itemSchema).min(1).max(50),
  notes: z.string().trim().max(500).optional().nullable(),
});

async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.wholesaleOrder.count({
    where: { orderNumber: { startsWith: `WO-${year}-` } },
  });
  return `WO-${year}-${String(count + 1).padStart(5, "0")}`;
}

export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const role = url.searchParams.get("role") || "buyer"; // buyer | supplier
    const status = url.searchParams.get("status");

    const where: any = {};
    if (role === "supplier") {
      const supplier = current.user.wholesaleSupplier;
      if (!supplier) {
        return NextResponse.json(
          { success: false, message: "ليس لديك حساب جملة" },
          { status: 403 }
        );
      }
      where.supplierId = supplier.id;
    } else {
      where.buyerUserId = current.user.id;
    }

    if (status && ["PENDING", "ACCEPTED", "REJECTED", "PREPARING", "READY", "COMPLETED", "CANCELLED"].includes(status)) {
      where.status = status;
    }

    const orders = await prisma.wholesaleOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        buyer: { select: { id: true, name: true, email: true, phone: true } },
        supplier: {
          select: {
            id: true,
            displayName: true,
            slug: true,
            isVerified: true,
            activityType: true,
            city: true,
          },
        },
        items: {
          select: {
            id: true,
            productName: true,
            variantName: true,
            sourceName: true,
            qty: true,
            unitPrice: true,
            total: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      role,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        subtotal: Number(o.subtotal),
        total: Number(o.total),
        notes: o.notes,
        rejectionReason: o.rejectionReason,
        itemCount: o.items.length,
        items: o.items.map((i) => ({
          id: i.id,
          productName: i.productName,
          variantName: i.variantName,
          sourceName: i.sourceName,
          qty: i.qty,
          unitPrice: Number(i.unitPrice),
          total: Number(i.total),
        })),
        buyer: o.buyer,
        supplier: o.supplier,
        createdAt: o.createdAt,
        acceptedAt: o.acceptedAt,
        rejectedAt: o.rejectedAt,
        completedAt: o.completedAt,
        cancelledAt: o.cancelledAt,
      })),
    });
  } catch (error) {
    console.error("Orders GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    if (!current.user.seller || current.user.seller.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "متجرك غير نشط — لا يمكن الطلب" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Load all offers
    const offerIds = Array.from(new Set(data.items.map((i) => i.offerId)));
    const offers = await prisma.sellerOffer.findMany({
      where: {
        id: { in: offerIds },
        isActive: true,
        deletedAt: null,
        supplier: { status: "ACTIVE", deletedAt: null },
      },
      include: {
        master: { select: { id: true, name: true } },
        source: { select: { name: true } },
        supplier: { select: { id: true } },
        variants: { select: { id: true, stock: true } },
      },
    });

    if (offers.length !== offerIds.length) {
      return NextResponse.json(
        { success: false, message: "بعض العروض غير متوفرة أو غير نشطة" },
        { status: 400 }
      );
    }

    // Verify all offers belong to the same supplier (one order = one supplier)
    const supplierIds = new Set(offers.map((o) => o.supplier.id));
    if (supplierIds.size > 1) {
      return NextResponse.json(
        {
          success: false,
          message: "كل طلب يجب أن يكون من بائع جملة واحد. قسّم الطلب حسب البائع.",
        },
        { status: 400 }
      );
    }

    const supplierId = offers[0].supplier.id;

    // Verify items against offers (min qty, max qty, stock)
    let subtotal = 0;
    const orderItemsData: Array<{
      offerId: number;
      offerVariantId: number | null;
      productName: string;
      variantName: string | null;
      sourceName: string;
      qty: number;
      unitPrice: number;
      total: number;
    }> = [];

    for (const item of data.items) {
      const offer = offers.find((o) => o.id === item.offerId);
      if (!offer) continue;

      if (item.qty < offer.minOrderQty) {
        return NextResponse.json(
          {
            success: false,
            message: `الحد الأدنى للطلب من "${offer.master.name}" هو ${offer.minOrderQty}`,
          },
          { status: 400 }
        );
      }

      if (offer.maxOrderQty && item.qty > offer.maxOrderQty) {
        return NextResponse.json(
          {
            success: false,
            message: `الحد الأقصى للطلب من "${offer.master.name}" هو ${offer.maxOrderQty}`,
          },
          { status: 400 }
        );
      }

      // Stock check
      if (item.offerVariantId) {
        const variant = offer.variants.find((v) => v.id === item.offerVariantId);
        if (!variant) {
          return NextResponse.json(
            { success: false, message: `variant #${item.offerVariantId} لا ينتمي لهذا العرض` },
            { status: 400 }
          );
        }
        if (variant.stock < item.qty) {
          return NextResponse.json(
            {
              success: false,
              message: `المخزون غير كافٍ لـ "${offer.master.name}" — المتوفر: ${variant.stock}`,
            },
            { status: 400 }
          );
        }
      } else {
        const totalStock = offer.variants.reduce((s, v) => s + v.stock, 0);
        if (totalStock < item.qty) {
          return NextResponse.json(
            {
              success: false,
              message: `المخزون غير كافٍ لـ "${offer.master.name}" — المتوفر: ${totalStock}`,
            },
            { status: 400 }
          );
        }
      }

      const unitPrice = Number(offer.wholesalePrice);
      const lineTotal = unitPrice * item.qty;
      subtotal += lineTotal;

      orderItemsData.push({
        offerId: offer.id,
        offerVariantId: item.offerVariantId || null,
        productName: offer.master.name,
        variantName: null,
        sourceName: offer.source?.name || "",
        qty: item.qty,
        unitPrice,
        total: lineTotal,
      });
    }

    const orderNumber = await generateOrderNumber();

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.wholesaleOrder.create({
        data: {
          orderNumber,
          buyerUserId: current.user.id,
          supplierId,
          status: "PENDING",
          subtotal,
          total: subtotal,
          notes: data.notes?.trim() || null,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: true,
          supplier: { select: { displayName: true } },
        },
      });

      // Notify supplier
      const supplierUser = await tx.wholesaleSupplier.findUnique({
        where: { id: supplierId },
        select: { userId: true },
      });
      if (supplierUser) {
        await tx.notification.create({
          data: {
            userId: supplierUser.userId,
            type: "ORDER_CREATED" as any,
            title: "طلب جملة جديد",
            message: `طلب جديد ${orderNumber} — ${orderItemsData.length} منتج`,
            link: `/seller/wholesale/orders`,
          },
        });
      }

      return newOrder;
    });

    return NextResponse.json(
      {
        success: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          total: Number(order.total),
          itemsCount: order.items.length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Order create error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء إنشاء الطلب" },
      { status: 500 }
    );
  }
}