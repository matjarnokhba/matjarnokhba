import { prisma } from "@/lib/prisma";

/**
 * M11.7: resolve available stock for an offer's variants.
 * - SHARED mode → InventoryPoolVariant (quantity - reservedQuantity)
 * - SPLIT/legacy → InventoryBalance[WHOLESALE] - active reservations
 *
 * Returns Map<offerVariantId, availableStock>
 */
export async function resolveOfferStockMap(offer: {
  businessUnitId: number;
  masterId: number;
  variants: Array<{
    id: number;
    masterVariantId: number;
    merchantVariantId: number | null;
  }>;
}): Promise<Map<number, number>> {
  const result = new Map<number, number>();

  const pool = await prisma.inventoryPool.findUnique({
    where: {
      businessUnitId_masterId: {
        businessUnitId: offer.businessUnitId,
        masterId: offer.masterId,
      },
    },
    include: { variants: true },
  });

  if (pool?.mode === "SHARED") {
    const poolByMv = new Map(pool.variants.map((v) => [v.masterVariantId, v]));
    for (const ov of offer.variants) {
      const pv = poolByMv.get(ov.masterVariantId);
      result.set(ov.id, pv ? Math.max(0, pv.quantity - pv.reservedQuantity) : 0);
    }
    return result;
  }

  // SPLIT
  const merchantVariantIds = offer.variants
    .map((v) => v.merchantVariantId)
    .filter((id): id is number => typeof id === "number");

  const balanceMap = new Map<number, number>();
  if (merchantVariantIds.length > 0) {
    const loc = await prisma.inventoryLocation.findFirst({
      where: { businessUnitId: offer.businessUnitId, isActive: true },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (loc) {
      const acc = await prisma.inventoryAccount.findFirst({
        where: { locationId: loc.id, type: "WHOLESALE", isActive: true },
        select: { id: true },
      });
      if (acc) {
        const [balances, reservations] = await Promise.all([
          prisma.inventoryBalance.findMany({
            where: {
              merchantVariantId: { in: merchantVariantIds },
              inventoryAccountId: acc.id,
            },
            select: { merchantVariantId: true, quantity: true },
          }),
          prisma.stockReservation.findMany({
            where: {
              merchantVariantId: { in: merchantVariantIds },
              status: "ACTIVE",
            },
            select: { merchantVariantId: true, quantity: true },
          }),
        ]);
        for (const b of balances) {
          balanceMap.set(
            b.merchantVariantId,
            (balanceMap.get(b.merchantVariantId) || 0) + b.quantity
          );
        }
        for (const r of reservations) {
          balanceMap.set(
            r.merchantVariantId,
            Math.max(0, (balanceMap.get(r.merchantVariantId) || 0) - r.quantity)
          );
        }
      }
    }
  }

  for (const ov of offer.variants) {
    result.set(
      ov.id,
      ov.merchantVariantId != null ? (balanceMap.get(ov.merchantVariantId) ?? 0) : 0
    );
  }
  return result;
}