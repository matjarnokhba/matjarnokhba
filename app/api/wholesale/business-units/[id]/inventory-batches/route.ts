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
    const merchantVariantIdRaw = url.searchParams.get("merchantVariantId");
    const accountIdRaw = url.searchParams.get("accountId");
    const onlyActiveRaw = url.searchParams.get("onlyActive");
    const pageRaw = url.searchParams.get("page");
    const pageSizeRaw = url.searchParams.get("pageSize");
    const page = Math.max(1, pageRaw ? parseInt(pageRaw, 10) : 1);
    const pageSize = Math.min(
      100,
      Math.max(1, pageSizeRaw ? parseInt(pageSizeRaw, 10) : 50)
    );

    const where: any = {
      inventoryAccount: { businessUnitId },
    };
    if (merchantVariantIdRaw) {
      const mvId = parseInt(merchantVariantIdRaw, 10);
      if (!isNaN(mvId)) where.merchantVariantId = mvId;
    }
    if (accountIdRaw) {
      const accId = parseInt(accountIdRaw, 10);
      if (!isNaN(accId)) where.inventoryAccountId = accId;
    }
    if (onlyActiveRaw === "true") where.quantityRemaining = { gt: 0 };

    const [total, items] = await Promise.all([
      prisma.inventoryBatch.count({ where }),
      prisma.inventoryBatch.findMany({
        where,
        orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          inventoryAccount: {
            select: {
              id: true,
              type: true,
              location: { select: { name: true } },
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
    return handleError(err, "GET /wholesale/business-units/[id]/inventory-batches");
  }
}