import { NextResponse } from "next/server";
import { z } from "zod";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { orderCreateSchema } from "@/lib/wholesale-order-validation";
import { WholesaleOrderService } from "@/services/wholesale-order.service";
import { checkBusinessAccess } from "@/lib/business-access";
import { WholesaleNotifications } from "@/lib/wholesale-notifications";
import { isWholesaleTrader } from "@/lib/business-type-guards";

const listQuerySchema = z.object({
  side: z.enum(["buyer", "seller"]).default("buyer"),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const { id } = await params;
    const businessId = parseInt(id);
    if (isNaN(businessId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }
    const access = await checkBusinessAccess(businessId, current.user.id);
    if ("error" in access) {
      return NextResponse.json({ success: false, message: access.error }, { status: access.status });
    }

    const url = new URL(request.url);
    const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "معاملات غير صحيحة" }, { status: 400 });
    }

    if (parsed.data.side === "buyer" && !(await isWholesaleTrader(businessId))) {
      return NextResponse.json(
        { success: false, message: "المشتريات متاحة لتجار الجملة فقط" },
        { status: 403 }
      );
    }

    const result = await WholesaleOrderService.listOrders(businessId, parsed.data.side, {
      status: parsed.data.status,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Orders GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const { id } = await params;
    const buyerBusinessId = parseInt(id);
    if (isNaN(buyerBusinessId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }

    const access = await checkBusinessAccess(buyerBusinessId, current.user.id, ["MANAGER", "SALES"]);
    if ("error" in access) {
      return NextResponse.json({ success: false, message: access.error }, { status: access.status });
    }
    if (!access.canWrite) {
      return NextResponse.json({ success: false, message: "لا تملك صلاحية إنشاء طلبات" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = orderCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const order = await WholesaleOrderService.createOrder(buyerBusinessId, current.user.id, {
      sellerBusinessId: parsed.data.sellerBusinessId,
      items: parsed.data.items,
      shippingCost: parsed.data.shippingCost,
      discountAmount: parsed.data.discountAmount,
      notes: parsed.data.notes,
      estimatedDelivery: parsed.data.estimatedDelivery,
    });

    // A7: notify seller (fire-and-forget)
    Promise.all([
      prisma.business.findUnique({ where: { id: buyerBusinessId }, select: { name: true } }),
      prisma.business.findUnique({ where: { id: parsed.data.sellerBusinessId }, select: { ownerUserId: true } }),
    ]).then(([buyerBiz, sellerBiz]) => {
      if (buyerBiz && sellerBiz) {
        WholesaleNotifications.orderPlaced(sellerBiz.ownerUserId, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          buyerName: buyerBiz.name,
          total: Number(order.total),
        }).catch((e) => console.error("notify:", e));
      }
    }).catch((e) => console.error("lookup:", e));

    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error) {
    console.error("Orders POST error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}