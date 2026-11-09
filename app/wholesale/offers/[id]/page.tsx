import { notFound, redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { OfferDetail } from "@/components/wholesale/offers/OfferDetail";
import type { OfferDetail as OfferDetailType } from "@/components/wholesale/offers/types";

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/offers");

  const { id } = await params;
  const offerId = parseInt(id, 10);
  if (isNaN(offerId) || offerId <= 0) notFound();

  const offer = await prisma.wholesaleOffer.findFirst({
    where: { id: offerId, deletedAt: null },
    include: {
      master: {
        select: {
          id: true,
          name: true,
          brand: true,
          description: true,
          images: true,
          barcode: true,
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
          owner: { select: { userId: true } },
          members: {
            where: {
              userId: current.user.id,
              isActive: true,
              deletedAt: null,
            },
            select: { id: true },
          },
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

  if (!offer) notFound();

  // Auth: must be owner or active member
  const isAdmin =
    current.user.role === "ADMIN" || current.user.role === "SUPER_ADMIN";
  const isOwner = offer.businessUnit.owner.userId === current.user.id;
  // M11: compute available stock per offer variant (WHOLESALE account - active reservations)
  const merchantVariantIds = offer.variants
    .map((v) => v.merchantVariantId)
    .filter((id): id is number => typeof id === "number");

  const availableStockByVariantId = new Map<number, number>();
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
        const balanceMap = new Map<number, number>();
        for (const b of balances) {
          balanceMap.set(b.merchantVariantId, (balanceMap.get(b.merchantVariantId) || 0) + b.quantity);
        }
        for (const r of reservations) {
          balanceMap.set(
            r.merchantVariantId,
            Math.max(0, (balanceMap.get(r.merchantVariantId) || 0) - r.quantity)
          );
        }
        for (const v of offer.variants) {
          if (v.merchantVariantId != null) {
            availableStockByVariantId.set(v.id, balanceMap.get(v.merchantVariantId) ?? 0);
          } else {
            availableStockByVariantId.set(v.id, 0);
          }
        }
      }
    }
  }
  const isMember = offer.businessUnit.members.length > 0;
  if (!isOwner && !isMember && !isAdmin) notFound();

  const serialized: OfferDetailType = {
    id: offer.id,
    masterId: offer.master.id,
    masterName: offer.master.name,
    masterBrand: offer.master.brand,
    masterImage: (offer.master.images as string[])[0] ?? null,
    businessUnitId: offer.businessUnit.id,
    businessUnitName: offer.businessUnit.name,
    businessUnitType: offer.businessUnit.type,
    wholesalePrice: Number(offer.wholesalePrice),
    minOrderQty: offer.minOrderQty,
    maxOrderQty: offer.maxOrderQty,
    status: offer.status,
    claimType: offer.claimType,
    claimVerified: offer.claimVerified,
    autoBalanceEnabled: offer.autoBalanceEnabled,
    requireSizeSelection: offer.requireSizeSelection,
    reviewLevel: offer.reviewLevel,
    variantCount: offer._count.variants,
    createdAt: offer.createdAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString(),
    notes: offer.notes,
    claimProofUrl: offer.claimProofUrl,
    claimNotes: offer.claimNotes,
    approvedAt: offer.approvedAt?.toISOString() ?? null,
    master: {
      id: offer.master.id,
      name: offer.master.name,
      brand: offer.master.brand,
      description: offer.master.description,
      images: offer.master.images as string[],
      barcode: offer.master.barcode,
    },
    businessUnit: {
      id: offer.businessUnit.id,
      name: offer.businessUnit.name,
      slug: offer.businessUnit.slug,
      type: offer.businessUnit.type,
      status: offer.businessUnit.status,
      verificationStatus: offer.businessUnit.verificationStatus,
    },
    variants: offer.variants.map((v) => ({
      id: v.id,
      masterVariantId: v.masterVariantId,
      attributes:
        (v.masterVariant?.attributes as Array<{
          name: string;
          value: string;
        }>) ?? [],
      availableStock: availableStockByVariantId.get(v.id) ?? 0,
      tiers: v.tiers.map((t) => ({
        id: t.id,
        minQty: t.minQty,
        maxQty: t.maxQty,
        unitPrice: Number(t.unitPrice),
      })),
    })),
    bundleRules: offer.bundleRules?.map((r) => ({
      id: r.id,
      triggerVariantId: r.triggerVariantId,
      requiredVariantId: r.requiredVariantId,
      minQuantity: r.minQuantity,
      isMultiplied: r.isMultiplied,
      notes: r.notes,
    })) ?? [],
    packages: offer.packages.map((p) => ({
      id: p.id,
      name: p.name,
      sortOrder: p.sortOrder,
      items: p.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    })),
  };

  return (
    <OfferDetail
      offer={serialized}
      isAdmin={isAdmin}
      isOwner={isOwner}
    />
  );
}