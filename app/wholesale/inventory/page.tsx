import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { InventoryPage } from "@/components/wholesale/inventory/InventoryPage";
import type {
  BalanceRow,
  BatchRow,
  InventoryAccountSummary,
  BUOption,
} from "@/components/wholesale/inventory/types";

export default async function InventoryServerPage({
  searchParams,
}: {
  searchParams: Promise<{ businessUnitId?: string }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/inventory");

  const params = await searchParams;
  const buIdRaw = params.businessUnitId || "";

  // Fetch user's BUs
  const owner = await prisma.businessOwner.findUnique({
    where: { userId: current.user.id },
    select: { id: true },
  });
  const ownerBUs = owner
    ? await prisma.businessUnit.findMany({
        where: { ownerId: owner.id, deletedAt: null, status: "ACTIVE" },
        select: { id: true, name: true, type: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const memberBUs = await prisma.businessUnitMember.findMany({
    where: {
      userId: current.user.id,
      isActive: true,
      deletedAt: null,
      businessUnit: { status: "ACTIVE", deletedAt: null },
    },
    select: { businessUnit: { select: { id: true, name: true, type: true } } },
  });
  const buMap = new Map<number, BUOption>();
  ownerBUs.forEach((b) => buMap.set(b.id, b));
  memberBUs.forEach((m) => {
    if (!buMap.has(m.businessUnit.id))
      buMap.set(m.businessUnit.id, m.businessUnit);
  });
  const businessUnits = Array.from(buMap.values());

  if (businessUnits.length === 0) {
    return (
      <InventoryPage
        businessUnits={[]}
        initialBusinessUnitId={0}
        accounts={[]}
        initialBalances={[]}
        initialBatches={[]}
      />
    );
  }

  const buIds = businessUnits.map((b) => b.id);
  const buIdFilter = buIdRaw ? parseInt(buIdRaw, 10) : null;
  const effectiveBU =
    buIdFilter && buIds.includes(buIdFilter) ? buIdFilter : buIds[0];

  // Fetch accounts for BU
  const accountsRaw = await prisma.inventoryAccount.findMany({
    where: { businessUnitId: effectiveBU, isActive: true },
    orderBy: [{ type: "asc" }, { id: "asc" }],
    select: {
      id: true,
      type: true,
      isActive: true,
      location: { select: { id: true, name: true, type: true } },
    },
  });

  const accounts: InventoryAccountSummary[] = accountsRaw.map((a) => ({
    id: a.id,
    type: a.type,
    locationName: a.location.name,
    locationType: a.location.type,
    isActive: a.isActive,
  }));

  // Fetch balances
  const balancesRaw = await prisma.inventoryBalance.findMany({
    where: {
      inventoryAccount: { businessUnitId: effectiveBU, isActive: true },
      quantity: { gt: 0 },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
    include: {
      inventoryAccount: {
        select: {
          id: true,
          type: true,
          location: { select: { name: true } },
        },
      },
    },
  });

  // Fetch variant info for each balance (batch)
  const variantIds = [
    ...new Set(balancesRaw.map((b) => b.merchantVariantId)),
  ];
  const variants = await prisma.merchantVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      sku: true,
      barcode: true,
      displayAttributes: true,
      merchantProduct: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  // Get reserved quantities per (variant, account)
  const reservationAggs = await prisma.stockReservation.groupBy({
    by: ["merchantVariantId", "inventoryAccountId"],
    where: {
      merchantVariantId: { in: variantIds },
      inventoryAccount: { businessUnitId: effectiveBU },
      status: "ACTIVE",
    },
    _sum: { quantity: true },
  });
  const reservedMap = new Map<string, number>();
  for (const r of reservationAggs) {
    reservedMap.set(
      `${r.merchantVariantId}:${r.inventoryAccountId}`,
      Number(r._sum.quantity ?? 0)
    );
  }

  const balances: BalanceRow[] = balancesRaw.map((b) => {
    const v = variantMap.get(b.merchantVariantId);
    const reserved =
      reservedMap.get(`${b.merchantVariantId}:${b.inventoryAccountId}`) ?? 0;
    return {
      merchantVariantId: b.merchantVariantId,
      inventoryAccountId: b.inventoryAccountId,
      accountType: b.inventoryAccount.type,
      locationName: b.inventoryAccount.location.name,
      sku: v?.sku ?? null,
      barcode: v?.barcode ?? null,
      productName: v?.merchantProduct.displayName ?? "—",
      productId: v?.merchantProduct.id ?? 0,
      variantAttributes:
        (v?.displayAttributes as Array<{ name: string; value: string }>) ?? [],
      onHand: b.quantity,
      reserved,
      available: Math.max(0, b.quantity - reserved),
      updatedAt: b.updatedAt.toISOString(),
    };
  });

  // Fetch active batches
  const batchesRaw = await prisma.inventoryBatch.findMany({
    where: {
      inventoryAccount: { businessUnitId: effectiveBU, isActive: true },
      quantityRemaining: { gt: 0 },
    },
    orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
    take: 500,
    include: {
      inventoryAccount: {
        select: {
          id: true,
          type: true,
          location: { select: { name: true } },
        },
      },
    },
  });

  const batchVariantIds = [
    ...new Set(batchesRaw.map((b) => b.merchantVariantId)),
  ];
  const batchVariants = await prisma.merchantVariant.findMany({
    where: { id: { in: batchVariantIds } },
    select: {
      id: true,
      sku: true,
      merchantProduct: { select: { displayName: true } },
    },
  });
  const batchVariantMap = new Map(batchVariants.map((v) => [v.id, v]));

  const batches: BatchRow[] = batchesRaw.map((b) => {
    const v = batchVariantMap.get(b.merchantVariantId);
    return {
      id: b.id,
      merchantVariantId: b.merchantVariantId,
      inventoryAccountId: b.inventoryAccountId,
      accountType: b.inventoryAccount.type,
      locationName: b.inventoryAccount.location.name,
      productName: v?.merchantProduct.displayName ?? "—",
      sku: v?.sku ?? null,
      sourceType: b.sourceType,
      sourceReferenceId: b.sourceReferenceId,
      quantityReceived: b.quantityReceived,
      quantityRemaining: b.quantityRemaining,
      unitCost: Number(b.unitCost),
      receivedAt: b.receivedAt.toISOString(),
    };
  });

  return (
    <InventoryPage
      businessUnits={businessUnits}
      initialBusinessUnitId={effectiveBU}
      accounts={accounts}
      initialBalances={balances}
      initialBatches={batches}
    />
  );
}