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
          notes: true,
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!offer) notFound();

  // Auth: must be owner or active member
  const isAdmin =
    current.user.role === "ADMIN" || current.user.role === "SUPER_ADMIN";
  const isOwner = offer.businessUnit.owner.userId === current.user.id;
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
      notes: r.notes,
    })) ?? [],
  };

  return (
    <OfferDetail
      offer={serialized}
      isAdmin={isAdmin}
      isOwner={isOwner}
    />
  );
}