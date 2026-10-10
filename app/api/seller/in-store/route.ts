import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { InventoryService } from "@/services/inventory.service";
import { AuditService } from "@/services/audit.service";

async function requireSeller() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };
  if (current.user.seller.status !== "ACTIVE") {
    return {
      error: "متجرك غير نشط حالياً — البيع المباشر متاح للمتاجر المعتمدة فقط",
      status: 403,
    };
  }
  return { user: current.user, seller: current.user.seller };
}

const createSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.number().int().positive(),
        quantity: z.number().int().positive().max(100),
      })
    )
    .min(1, "أضف منتجاً واحداً على الأقل"),
  customerName: z.string().trim().max(100).optional().nullable(),
  customerPhone: z.string().trim().max(20).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireSeller();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
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
    const sellerId = auth.seller.id;

    // ═══ التحقق من variants ═══
    const variantIds = data.items.map((i) => i.variantId);
    const variants = await prisma.productVariant.findMany({
      where: {
        id: { in: variantIds },
        isActive: true,
        product: {
          sellerId,
          deletedAt: null,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            images: {
              where: { isMain: true },
              take: 1,
              select: { url: true },
            },
          },
        },
        inventory: {
          select: { quantity: true, reservedQuantity: true },
        },
        optionValues: {
          include: {
            optionValue: {
              include: { option: true },
            },
          },
        },
      },
    });

    if (variants.length !== variantIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "بعض المنتجات لا تخص متجرك أو غير متوفرة",
        },
        { status: 400 }
      );
    }

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // ═══ التحقق من المخزون ═══
    for (const item of data.items) {
      const v = variantMap.get(item.variantId);
      if (!v) throw new Error("منتج غير موجود");
      const available = v.inventory?.quantity ?? 0;
      if (available < item.quantity) {
        return NextResponse.json(
          {
            success: false,
            message: `الكمية غير متوفرة للمنتج "${v.product.name}"`,
          },
          { status: 400 }
        );
      }
    }

    // ═══ حساب الأسعار من DB ═══
    const itemsWithPrice = data.items.map((item) => {
      const v = variantMap.get(item.variantId)!;
      const unitPrice = Number(v.price);

      const sortedOV = [...v.optionValues].sort(
        (a, b) =>
          (a.optionValue.option.order ?? 0) -
          (b.optionValue.option.order ?? 0)
      );
      const variantName =
        sortedOV.length > 0
          ? sortedOV.map((ov) => ov.optionValue.value).join(" / ")
          : null;

      return {
        productId: v.product.id,
        variantId: v.id,
        productName: v.product.name,
        variantName,
        imageUrl: v.product.images[0]?.url ?? null,
        sku: v.sku,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
      };
    });

    const subtotal = itemsWithPrice.reduce((s, i) => s + i.lineTotal, 0);
    const total = subtotal;

    // ═══ Transaction ═══
    const order = await prisma.$transaction(
      async (tx) => {
        // 1. رقم الطلب
        const year = new Date().getFullYear();
        const seq = await tx.orderSequence.upsert({
          where: { year },
          create: { year, lastNumber: 1 },
          update: { lastNumber: { increment: 1 } },
        });
        const orderNumber = `INS-${year}-${String(seq.lastNumber).padStart(5, "0")}`;

        // 2. إنشاء الطلب
        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            userId: auth.user.id,
            sellerId,
            source: "IN_STORE",
            createdBySellerId: sellerId,
            status: "DELIVERED",
            paymentMethod: "COD",
            paymentStatus: "PAID",
            subtotal,
            taxAmount: 0,
            shippingCost: 0,
            discount: 0,
            total,
            shippingAddressSnapshot: {
              type: "IN_STORE",
              customerName: data.customerName || null,
              customerPhone: data.customerPhone || null,
            },
            customerSnapshot: {
              id: null,
              name: data.customerName || "عميل المحل",
              phone: data.customerPhone || null,
            },
            deliveredAt: new Date(),
            notes: data.note || null,
            items: {
              create: itemsWithPrice.map((item) => ({
                productId: item.productId,
                variantId: item.variantId,
                productName: item.productName,
                variantName: item.variantName,
                imageUrl: item.imageUrl,
                sku: item.sku,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.lineTotal,
                taxRate: 0,
                taxAmount: 0,
              })),
            },
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: "DELIVERED",
                changedById: auth.user.id,
                note: "طلب محل — تم البيع مباشرة",
              },
            },
          },
        });

        // 3. خصم المخزون
        const sortedItems = [...itemsWithPrice].sort(
          (a, b) => a.variantId - b.variantId
        );
        for (const item of sortedItems) {
          await InventoryService.saleDirect(
            tx,
            item.variantId,
            item.quantity,
            newOrder.id
          );
        }

        // 4. تحديث sold
        const soldByProduct = new Map<number, number>();
        for (const item of itemsWithPrice) {
          soldByProduct.set(
            item.productId,
            (soldByProduct.get(item.productId) || 0) + item.quantity
          );
        }
        for (const [productId, qty] of soldByProduct) {
          await tx.product.update({
            where: { id: productId },
            data: { sold: { increment: qty } },
          });
        }

        // 5. Audit Log
        const reqInfo = AuditService.getRequestInfo(request);
        await AuditService.logInTransaction(tx, {
          userId: auth.user.id,
          action: "CREATE",
          entity: "Order",
          entityId: String(newOrder.id),
          newData: {
            source: "IN_STORE",
            orderNumber: newOrder.orderNumber,
            total: Number(newOrder.total),
            itemsCount: itemsWithPrice.length,
          },
          ipAddress: reqInfo.ipAddress,
          userAgent: reqInfo.userAgent,
        });

        return newOrder;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    return NextResponse.json(
      {
        success: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          total: Number(order.total),
          itemsCount: itemsWithPrice.length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("In-store order error:", error);
    const message =
      error instanceof Error ? error.message : "حدث خطأ أثناء إنشاء الطلب";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}