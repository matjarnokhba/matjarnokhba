import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { MarketplaceBrowse } from "@/components/marketplace/MarketplaceBrowse";
import type {
  PublicOfferItem,
  BuyerBU,
} from "@/components/marketplace/types";

const PAGE_SIZE = 24;

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    categoryId?: string;
    businessType?: string;
    claimVerified?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/marketplace");

  const params = await searchParams;
  const search = params.search || "";
  const categoryIdRaw = params.categoryId || "";
  const businessType = params.businessType || "";
  const claimVerifiedRaw = params.claimVerified || "";
  const minPriceRaw = params.minPrice || "";
  const maxPriceRaw = params.maxPrice || "";
  const sort = params.sort || "";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  // Verify user has at least one active BU with WHOLESALE_BUY capability
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
      .filter((b) => ((b.capabilities as string[]) ?? []).includes("WHOLESALE_BUY"))
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
    if (caps.includes("WHOLESALE_BUY") && !buyerBUs.some((x) => x.id === bu.id)) {
      buyerBUs.push({ id: bu.id, name: bu.name, type: bu.type });
    }
  }

  // Fetch categories for filter
  const categories = await prisma.masterCategory.findMany({
    where: { isLeaf: true, isActive: true, deletedAt: null },
    select: { id: true, name: true },
    orderBy: [{ parentId: "asc" }, { order: "asc" }],
    take: 100,
  });

  // Build offer where clause
  const where: any = {
    status: "ACTIVE",
    deletedAt: null,
    businessUnit: { status: "ACTIVE", deletedAt: null },
    master: { status: "ACTIVE", deletedAt: null },
  };
  if (categoryIdRaw) {
    const catId = parseInt(categoryIdRaw, 10);
    if (!isNaN(catId)) where.master.categoryId = catId;
  }
  if (businessType) where.businessUnit.type = businessType;
  if (claimVerifiedRaw === "true") where.claimVerified = true;
  else if (claimVerifiedRaw === "false") where.claimVerified = false;
  if (minPriceRaw || maxPriceRaw) {
    where.wholesalePrice = {};
    if (minPriceRaw) {
      const mp = parseFloat(minPriceRaw);
      if (!isNaN(mp)) where.wholesalePrice.gte = mp;
    }
    if (maxPriceRaw) {
      const mp = parseFloat(maxPriceRaw);
      if (!isNaN(mp)) where.wholesalePrice.lte = mp;
    }
  }
  if (search.trim().length >= 2) {
    const q = search.trim();
    where.OR = [
      { master: { name: { contains: q, mode: "insensitive" } } },
      { master: { brand: { contains: q, mode: "insensitive" } } },
      { businessUnit: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  let orderBy: any;
  switch (sort) {
    case "price_asc":
      orderBy = [{ wholesalePrice: "asc" }, { createdAt: "desc" }];
      break;
    case "price_desc":
      orderBy = [{ wholesalePrice: "desc" }, { createdAt: "desc" }];
      break;
    case "moq_asc":
      orderBy = [{ minOrderQty: "asc" }, { createdAt: "desc" }];
      break;
    case "verified_first":
      orderBy = [{ claimVerified: "desc" }, { createdAt: "desc" }];
      break;
    case "newest":
    default:
      orderBy = [{ createdAt: "desc" }];
  }

  const [total, rows] = await Promise.all([
    prisma.wholesaleOffer.count({ where }),
    prisma.wholesaleOffer.findMany({
      where,
      orderBy,
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
        businessUnit: {
          select: {
            id: true,
            name: true,
            type: true,
            verificationStatus: true,
          },
        },
        variants: {
          include: {
            tiers: {
              orderBy: { minQty: "asc" },
              select: { unitPrice: true },
            },
          },
        },
        _count: { select: { variants: true } },
      },
    }),
  ]);

  const items: PublicOfferItem[] = rows.map((r) => {
    const prices: number[] = [];
    for (const v of r.variants) {
      for (const t of v.tiers) {
        prices.push(Number(t.unitPrice));
      }
    }
    const minPrice = prices.length > 0 ? Math.min(...prices) : Number(r.wholesalePrice);
    const maxPrice = prices.length > 0 ? Math.max(...prices) : minPrice;

    return {
      id: r.id,
      masterId: r.master.id,
      masterName: r.master.name,
      masterBrand: r.master.brand,
      masterImage: (r.master.images as string[])[0] ?? null,
      sellerName: r.businessUnit.name,
      sellerType: r.businessUnit.type,
      sellerVerificationStatus: r.businessUnit.verificationStatus,
      wholesalePrice: Number(r.wholesalePrice),
      minPrice,
      maxPrice,
      minOrderQty: r.minOrderQty,
      maxOrderQty: r.maxOrderQty,
      claimType: r.claimType,
      claimVerified: r.claimVerified,
      variantCount: r._count.variants,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return (
    <MarketplaceBrowse
      items={items}
      categories={categories}
      buyerBUs={buyerBUs}
      filters={{
        search,
        categoryId: categoryIdRaw,
        businessType,
        claimVerified: claimVerifiedRaw,
        minPrice: minPriceRaw,
        maxPrice: maxPriceRaw,
        sort,
      }}
      pagination={{
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      }}
    />
  );
}