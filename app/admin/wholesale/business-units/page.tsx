import { prisma } from "@/lib/prisma";
import { BusinessUnitsAdminList } from "@/components/admin/wholesale/BusinessUnitsAdminList";

const PAGE_SIZE = 30;

export default async function AdminBusinessUnitsPage({
  searchParams,
}: {
  searchParams: Promise<{
    verification?: string;
    type?: string;
    search?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const verification = params.verification || "PENDING";
  const type = params.type || "";
  const search = params.search || "";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  const where: any = { deletedAt: null };
  if (verification && verification !== "ALL") {
    where.verificationStatus = verification;
  }
  if (type) where.type = type;
  if (search.trim().length >= 2) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows, verifCounts] = await Promise.all([
    prisma.businessUnit.count({ where }),
    prisma.businessUnit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            user: { select: { id: true, email: true } },
          },
        },
        legalEntity: { select: { id: true, name: true } },
        _count: {
          select: {
            merchantProducts: { where: { deletedAt: null } },
            offers: { where: { deletedAt: null } },
            inventoryLocations: true,
          },
        },
      },
    }),
    prisma.businessUnit.groupBy({
      by: ["verificationStatus"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const verificationCounts: Record<string, number> = {};
  for (const vc of verifCounts) {
    verificationCounts[vc.verificationStatus] = vc._count._all;
  }

  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    type: r.type,
    status: r.status,
    capabilities: (r.capabilities as string[]) ?? [],
    registrationStatus: r.registrationStatus,
    verificationStatus: r.verificationStatus,
    logo: r.logo,
    createdAt: r.createdAt.toISOString(),
    owner: {
      id: r.owner.id,
      displayName: r.owner.displayName,
      email: r.owner.user.email,
      userId: r.owner.user.id,
    },
    legalEntity: r.legalEntity
      ? { id: r.legalEntity.id, name: r.legalEntity.name }
      : null,
    counts: {
      merchantProducts: r._count.merchantProducts,
      offers: r._count.offers,
      inventoryLocations: r._count.inventoryLocations,
    },
  }));

  return (
    <BusinessUnitsAdminList
      items={items}
      verificationCounts={verificationCounts}
      currentVerification={verification}
      currentType={type}
      currentSearch={search}
      pagination={{
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      }}
    />
  );
}