import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { OffersList } from "@/components/wholesale/offers/OffersList";
import type { OfferListItem, BUOption } from "@/components/wholesale/offers/types";

const PAGE_SIZE = 30;

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
    businessUnitId?: string;
  }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/offers");

  const params = await searchParams;
  const status = params.status || "";
  const search = params.search || "";
  const buIdRaw = params.businessUnitId || "";
  const buIdFilter = buIdRaw ? parseInt(buIdRaw, 10) : null;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  // Collect user's BUs (owner + member)
  const owner = await prisma.businessOwner.findUnique({
    where: { userId: current.user.id },
    select: { id: true },
  });

  const ownerBUs = owner
    ? await prisma.businessUnit.findMany({
        where: { ownerId: owner.id, deletedAt: null },
        select: { id: true, name: true, type: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const memberBUs = await prisma.businessUnitMember.findMany({
    where: {
      userId: current.user.id,
      isActive: true,
      deletedAt: null,
      businessUnit: { deletedAt: null },
    },
    select: {
      businessUnit: {
        select: { id: true, name: true, type: true },
      },
    },
  });

  const buMap = new Map<number, BUOption>();
  ownerBUs.forEach((b) => buMap.set(b.id, b));
  memberBUs.forEach((m) => {
    if (!buMap.has(m.businessUnit.id)) buMap.set(m.businessUnit.id, m.businessUnit);
  });
  const businessUnits = Array.from(buMap.values());

  if (businessUnits.length === 0) {
    return (
      <OffersList
        items={[]}
        pagination={{ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 }}
        businessUnits={[]}
        currentStatus={status}
        currentBUId={buIdRaw}
        currentSearch={search}
      />
    );
  }

  const buIds = businessUnits.map((b) => b.id);
  const where: any = {
    businessUnitId: { in: buIds },
    deletedAt: null,
  };
  if (buIdFilter && buIds.includes(buIdFilter)) {
    where.businessUnitId = buIdFilter;
  }
  if (status) where.status = status;
  if (search.trim().length >= 2) {
    const q = search.trim();
    where.OR = [
      { master: { name: { contains: q, mode: "insensitive" } } },
      { businessUnit: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.wholesaleOffer.count({ where }),
    prisma.wholesaleOffer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        master: {
          select: {
            id: true,
            name: true,
            brand: true,
            images: true,
          },
        },
        businessUnit: { select: { id: true, name: true, type: true } },
        _count: { select: { variants: true } },
      },
    }),
  ]);

  const items: OfferListItem[] = rows.map((r) => ({
    id: r.id,
    masterId: r.master.id,
    masterName: r.master.name,
    masterBrand: r.master.brand,
    masterImage: (r.master.images as string[])[0] ?? null,
    businessUnitId: r.businessUnit.id,
    businessUnitName: r.businessUnit.name,
    businessUnitType: r.businessUnit.type,
    wholesalePrice: Number(r.wholesalePrice),
    minOrderQty: r.minOrderQty,
    maxOrderQty: r.maxOrderQty,
    status: r.status,
    claimType: r.claimType,
    claimVerified: r.claimVerified,
    reviewLevel: r.reviewLevel,
    variantCount: r._count.variants,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <OffersList
      items={items}
      pagination={{
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      }}
      businessUnits={businessUnits}
      currentStatus={status}
      currentBUId={buIdRaw}
      currentSearch={search}
    />
  );
}