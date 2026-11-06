import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { MasterProductsList } from "@/components/wholesale/master-products/MasterProductsList";
import type { SerializedListItem, Pagination } from "@/components/wholesale/master-products/types";

const PAGE_SIZE = 30;

export default async function MasterProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/master-products");

  const params = await searchParams;
  const status = params.status || "";
  const search = params.search || "";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  const where: any = {
    createdByUserId: current.user.id,
    deletedAt: null,
  };
  if (status) where.status = status;
  if (search.trim().length >= 2) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q } },
      { brand: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.masterProduct.count({ where }),
    prisma.masterProduct.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        category: { select: { id: true, name: true } },
        _count: {
          select: {
            variants: true,
            merchantProducts: { where: { deletedAt: null } },
          },
        },
      },
    }),
  ]);

  const items: SerializedListItem[] = rows.map((r) => ({
    id: r.id,
    masterCode: r.masterCode,
    name: r.name,
    brand: r.brand,
    barcode: r.barcode,
    images: r.images as string[],
    status: r.status,
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    category: r.category,
    variantCount: r._count.variants,
    merchantProductCount: r._count.merchantProducts,
  }));

  const pagination: Pagination = {
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };

  return (
    <MasterProductsList
      items={items}
      pagination={pagination}
      currentStatus={status}
      currentSearch={search}
    />
  );
}