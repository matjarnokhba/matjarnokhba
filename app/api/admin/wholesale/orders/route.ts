import { requireAdmin, handleError, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const statusRaw = url.searchParams.get("status");
    const status = statusRaw
      ? (statusRaw as
          | "PENDING"
          | "CONFIRMED"
          | "PROCESSING"
          | "READY"
          | "SHIPPED"
          | "DELIVERED"
          | "CANCELLED"
          | "RETURNED"
          | "DISPUTED")
      : undefined;
    const paymentStatus = url.searchParams.get("paymentStatus") as
      | "UNPAID"
      | "PARTIAL"
      | "PAID"
      | "REFUNDED"
      | null;
    const sellerBU = url.searchParams.get("sellerBusinessUnitId");
    const buyerBU = url.searchParams.get("buyerBusinessUnitId");
    const search = url.searchParams.get("search") || undefined;
    const pageRaw = url.searchParams.get("page");
    const pageSizeRaw = url.searchParams.get("pageSize");

    const page = Math.max(1, pageRaw ? parseInt(pageRaw, 10) : 1);
    const pageSize = Math.min(
      100,
      Math.max(1, pageSizeRaw ? parseInt(pageSizeRaw, 10) : 30)
    );

    const where: any = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (sellerBU) where.sellerBusinessUnitId = parseInt(sellerBU, 10);
    if (buyerBU) where.buyerBusinessUnitId = parseInt(buyerBU, 10);
    if (search && search.trim().length >= 2) {
      where.orderNumber = { contains: search.trim() };
    }

    const [total, items] = await Promise.all([
      prisma.wholesaleOrder.count({ where }),
      prisma.wholesaleOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          group: { select: { id: true, groupNumber: true, status: true } },
          items: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              subtotal: true,
            },
          },
        },
      }),
    ]);

    return ok({
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    return handleError(err, "GET /admin/wholesale/orders");
  }
}