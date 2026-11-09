import { notFound, redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { OfferDetailPublic } from "@/components/marketplace/OfferDetailPublic";
import type {
  PublicOfferDetail,
  BuyerBU,
} from "@/components/marketplace/types";

export default async function MarketplaceOfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/marketplace");

  const { id } = await params;
  const offerId = parseInt(id, 10);
  if (isNaN(offerId) || offerId <= 0) notFound();

  const offer = await prisma.wholesaleOffer.findUnique({
    where: { id: offerId },
    include: {
      master: {
        select: {
          id: true,
          name: true,
          brand: true,
          description: true,
          images: true,
          barcode: true,
          categoryId: true,
        },
      },
      businessUnit: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          status: true,
          verificationStatus: true,
          ownerId: true,
        },
      },
      variants: {
        orderBy: { id: "asc" },
        include: {
          masterVariant: {
            select: { id: true, attributes: true, isDefault: true },
          },
          tiers: { orderBy: { minQty: "asc" } },
        },
      },
      _count: { select: { variants: true } },
      bundleRules: {
        select: {
          id: true,
          triggerVariantId: true,
          requiredVariantId: true,
          minQuantity: true,
          isMultiplied: true,
          notes: true,
        },
        orderBy: { id: "asc" },
      },
      packages: {
        include: { items: { select: { variantId: true, quantity: true } } },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!offer || offer.deletedAt) notFound();

  // Must be ACTIVE offer for public viewing
  if (offer.status !== "ACTIVE") notFound();
  if (offer.businessUnit.status !== "ACTIVE") notFound();
  if (offer.master.categoryId === 0) {
    // master status check
    const masterStatus = await prisma.masterProduct.findUnique({
      where: { id: offer.masterId },
      select: { status: true, deletedAt: true },
    });
    if (
      !masterStatus ||
      masterStatus.status !== "ACTIVE" ||
      masterStatus.deletedAt
    ) {
      notFound();
    }
  }

  // Fetch user's BUs with WHOLESALE_BUY
  const owner = await prisma.businessOwner.findUnique({
    where: { userId: current.user.id },
    select: { id: true },
  });

  let buyerBUs: BuyerBU[] = [];
  if (owner) {
    const owned = await prisma.businessUnit.findMany({
      where: { ownerId: owner.id, deletedAt: null, status: "ACTIVE" },
      select: { id: true, name: true, type: true, capabilities: true },
    });
    buyerBUs = owned
      .filter((b) =>
        ((b.capabilities as string[]) ?? []).includes("WHOLESALE_BUY")
      )
      .map((b) => ({ id: b.id, name: b.name, type: b.type }));
  }
  const memberBUs = await prisma.businessUnitMember.findMany({
    where: {
      userId: current.user.id,
      isActive: true,
      deletedAt: null,
      businessUnit: { status: "ACTIVE", deletedAt: null },
    },
    select: {
      businessUnit: {
        select: { id: true, name: true, type: true, capabilities: true },
      },
    },
  });
  for (const m of memberBUs) {
    const bu = m.businessUnit;
    const caps = (bu.capabilities as string[]) ?? [];
    if (
      caps.includes("WHOLESALE_BUY") &&
      !buyerBUs.some((x) => x.id === bu.id)
    ) {
      buyerBUs.push({ id: bu.id, name: bu.name, type: bu.type });
    }
  }

  // Price range
  const prices: number[] = [];
  for (const v of offer.variants) {
    for (const t of v.tiers) {
      prices.push(Number(t.unitPrice));
    }
  }
  const minPrice =
    prices.length > 0 ? Math.min(...prices) : Number(offer.wholesalePrice);
  const maxPrice = prices.length > 0 ? Math.max(...prices) : minPrice;

  // Cannot buy own offer
  const isOwnOffer = offer.businessUnit.ownerId === owner?.id;

  // M9.2: compute available stock per variant
  const merchantVariantIds = offer.variants
    .map((v) => v.merchantVariantId)
    .filter((id): id is number => typeof id === "number");
  const availableStockByMerchantVariant = new Map<number, number>();
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
            where: { merchantVariantId: { in: merchantVariantIds }, inventoryAccountId: acc.id },
            select: { merchantVariantId: true, quantity: true },
          }),
          prisma.stockReservation.findMany({
            where: { merchantVariantId: { in: merchantVariantIds }, status: "ACTIVE" },
            select: { merchantVariantId: true, quantity: true },
          }),
        ]);
        for (const b of balances) {
          availableStockByMerchantVariant.set(
            b.merchantVariantId,
            (availableStockByMerchantVariant.get(b.merchantVariantId) || 0) + b.quantity
          );
        }
        for (const r of reservations) {
          const cur = availableStockByMerchantVariant.get(r.merchantVariantId) || 0;
          availableStockByMerchantVariant.set(
            r.merchantVariantId,
            Math.max(0, cur - r.quantity)
          );
        }
      }
    }
  }

  const serialized: PublicOfferDetail = {
    id: offer.id,
    masterId: offer.masterId,
    masterName: offer.master.name,
    masterBrand: offer.master.brand,
    masterImage: (offer.master.images as string[])[0] ?? null,
    sellerName: offer.businessUnit.name,
    sellerType: offer.businessUnit.type,
    sellerVerificationStatus: offer.businessUnit.verificationStatus,
    wholesalePrice: Number(offer.wholesalePrice),
    minPrice,
    maxPrice,
    minOrderQty: offer.minOrderQty,
    maxOrderQty: offer.maxOrderQty,
    claimType: offer.claimType,
    claimVerified: offer.claimVerified,
    autoBalanceEnabled: offer.autoBalanceEnabled,
    requireSizeSelection: offer.requireSizeSelection,
    variantCount: offer._count.variants,
    createdAt: offer.createdAt.toISOString(),
    description: offer.notes,
    businessUnitSlug: offer.businessUnit.slug,
    master: {
      id: offer.master.id,
      name: offer.master.name,
      brand: offer.master.brand,
      description: offer.master.description,
      images: offer.master.images as string[],
      barcode: offer.master.barcode,
    },
    variants: offer.variants.map((v) => ({
      id: v.id,
      masterVariantId: v.masterVariantId,
      attributes:
        (v.masterVariant?.attributes as Array<{
          name: string;
          value: string;
        }>) ?? [],
      tiers: v.tiers.map((t) => ({
        id: t.id,
        minQty: t.minQty,
        maxQty: t.maxQty,
        unitPrice: Number(t.unitPrice),
      })),
      availableStock: v.merchantVariantId != null
        ? (availableStockByMerchantVariant.get(v.merchantVariantId) ?? 0)
        : null,
    })),
    bundleRules: offer.bundleRules.map((r) => ({
      id: r.id,
      triggerVariantId: r.triggerVariantId,
      requiredVariantId: r.requiredVariantId,
      minQuantity: r.minQuantity,
      isMultiplied: r.isMultiplied,
      notes: r.notes,
    })),
    packages: offer.packages.map((p) => ({
      id: p.id,
      name: p.name,
      sortOrder: p.sortOrder,
      items: p.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    })),
  };

  return (
    <OfferDetailPublic
      offer={serialized}
      buyerBUs={buyerBUs}
      isOwnOffer={isOwnOffer}
    />
  );
}