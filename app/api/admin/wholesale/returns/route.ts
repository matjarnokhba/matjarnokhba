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
          | "REQUESTED"
          | "APPROVED"
          | "REJECTED"
          | "PENDING_SHIPMENT"
          | "RECEIVED"
          | "INSPECTED"
          | "PARTIALLY_ACCEPTED"
          | "COMPLETED"
          | "CANCELLED")
      : undefined;
    const buyerBU = url.searchParams.get("buyerBusinessUnitId");
    const sellerBU = url.searchParams.get("sellerBusinessUnitId");
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
    if (buyerBU) where.buyerBusinessUnitId = parseInt(buyerBU, 10);
    if (sellerBU) where.sellerBusinessUnitId = parseInt(sellerBU, 10);
    if (search && search.trim().length >= 2) {
      where.returnNumber = { contains: search.trim() };
    }

    const [total, items] = await Promise.all([
      prisma.returnOrder.count({ where }),
      prisma.returnOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          returnNumber: true,
          originalOrderId: true,
          buyerBusinessUnitId: true,
          sellerBusinessUnitId: true,
          status: true,
          reason: true,
          expectedRefundAmount: true,
          approvedRefundAmount: true,
          createdAt: true,
          completedAt: true,
          _count: { select: { items: true } },
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
    return handleError(err, "GET /admin/wholesale/returns");
  }
}