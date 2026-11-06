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