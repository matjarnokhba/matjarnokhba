import {
  requireAuth,
  handleError,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getBusinessUnitContext } from "@/lib/wholesale/context";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const businessUnitId = numericParam(id);
    if (!businessUnitId) return fail("معرف غير صحيح", 400);

    await getBusinessUnitContext(auth.current.user.id, businessUnitId);

    const url = new URL(request.url);
    const pageRaw = url.searchParams.get("page");
    const pageSizeRaw = url.searchParams.get("pageSize");
    const page = Math.max(1, pageRaw ? parseInt(pageRaw, 10) : 1);
    const pageSize = Math.min(
      100,
      Math.max(1, pageSizeRaw ? parseInt(pageSizeRaw, 10) : 50)
    );
    const accountType = url.searchParams.get("accountType") as
      | "RETAIL"
      | "WHOLESALE"
      | "QUARANTINE"
      | "DAMAGED"
      | null;

    const where: any = {
      inventoryAccount: { businessUnitId, isActive: true },
      quantity: { gt: 0 },
    };
    if (accountType) where.inventoryAccount.type = accountType;

    const [total, balances, accounts] = await Promise.all([
      prisma.inventoryBalance.count({ where }),
      prisma.inventoryBalance.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          inventoryAccount: {
            select: {
              id: true,
              type: true,
              location: { select: { id: true, name: true, type: true } },
            },
          },
        },
      }),
      prisma.inventoryAccount.findMany({
        where: { businessUnitId, isActive: true },
        orderBy: [{ type: "asc" }, { id: "asc" }],
        select: {
          id: true,
          type: true,
          location: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Enrich balances with reservations
    const enriched = [];
    for (const b of balances) {
      const reservedAgg = await prisma.stockReservation.aggregate({
        where: {
          merchantVariantId: b.merchantVariantId,
          inventoryAccountId: b.inventoryAccountId,
          status: "ACTIVE",
        },
        _sum: { quantity: true },
      });
      const reserved = Number(reservedAgg._sum.quantity ?? 0);
      enriched.push({
        merchantVariantId: b.merchantVariantId,
        inventoryAccountId: b.inventoryAccountId,
        accountType: b.inventoryAccount.type,
        location: b.inventoryAccount.location,
        onHand: b.quantity,
        reserved,
        available: Math.max(0, b.quantity - reserved),
        lastLedgerId: b.lastLedgerId,
        updatedAt: b.updatedAt,
      });
    }

    return ok({
      accounts,
      balances: enriched,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    return handleError(err, "GET /wholesale/business-units/[id]/inventory");
  }
}