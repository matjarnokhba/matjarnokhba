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
  _request: Request,
  { params }: { params: Promise<{ id: string; merchantVariantId: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id, merchantVariantId } = await params;
    const businessUnitId = numericParam(id);
    const mvId = numericParam(merchantVariantId);
    if (!businessUnitId || !mvId) return fail("معرف غير صحيح", 400);

    await getBusinessUnitContext(auth.current.user.id, businessUnitId);

    // Verify MV belongs to BU
    const mv = await prisma.merchantVariant.findFirst({
      where: {
        id: mvId,
        merchantProduct: { businessUnitId, deletedAt: null },
      },
      include: {
        merchantProduct: {
          select: { id: true, displayName: true, masterId: true },
        },
      },
    });
    if (!mv) return fail("المتغير غير موجود أو لا ينتمي لهذا النشاط", 404);

    const balances = await prisma.inventoryBalance.findMany({
      where: {
        merchantVariantId: mvId,
        inventoryAccount: { businessUnitId, isActive: true },
      },
      include: {
        inventoryAccount: {
          select: {
            id: true,
            type: true,
            location: { select: { id: true, name: true } },
          },
        },
      },
    });

    const enriched = [];
    for (const b of balances) {
      const reservedAgg = await prisma.stockReservation.aggregate({
        where: {
          merchantVariantId: mvId,
          inventoryAccountId: b.inventoryAccountId,
          status: "ACTIVE",
        },
        _sum: { quantity: true },
      });
      const reserved = Number(reservedAgg._sum.quantity ?? 0);
      enriched.push({
        inventoryAccountId: b.inventoryAccountId,
        accountType: b.inventoryAccount.type,
        location: b.inventoryAccount.location,
        onHand: b.quantity,
        reserved,
        available: Math.max(0, b.quantity - reserved),
        updatedAt: b.updatedAt,
      });
    }

    // Active batches
    const batches = await prisma.inventoryBatch.findMany({
      where: {
        merchantVariantId: mvId,
        inventoryAccount: { businessUnitId },
        quantityRemaining: { gt: 0 },
      },
      orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        inventoryAccountId: true,
        sourceType: true,
        sourceReferenceId: true,
        quantityReceived: true,
        quantityRemaining: true,
        unitCost: true,
        receivedAt: true,
      },
    });

    // Active reservations
    const reservations = await prisma.stockReservation.findMany({
      where: {
        merchantVariantId: mvId,
        inventoryAccount: { businessUnitId },
        status: "ACTIVE",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        inventoryAccountId: true,
        quantity: true,
        stage: true,
        status: true,
        expiresAt: true,
        referenceType: true,
        referenceId: true,
        createdAt: true,
      },
    });

    return ok({
      variant: {
        id: mv.id,
        sku: mv.sku,
        barcode: mv.barcode,
        displayAttributes: mv.displayAttributes,
        product: mv.merchantProduct,
      },
      balances: enriched,
      batches,
      reservations,
    });
  } catch (err) {
    return handleError(
      err,
      "GET /wholesale/business-units/[id]/inventory/[merchantVariantId]"
    );
  }
}