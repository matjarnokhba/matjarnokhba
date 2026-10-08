import { prisma } from "@/lib/prisma";

type PrismaProduct = {
  id: number;
  productCode: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  badge: string | null;
  rating: number;
  reviewsCount: number;
  sold: number;
  freeShipping: boolean;
  seller: { id: number; slug: string; storeName: string } | null;
  category: { slug: string; name: string } | null;
  images: { url: string }[];
  variants: {
    id: number;
    price: unknown;
    discountPrice: unknown;
    inventory: { quantity: number } | null;
  }[];
  _count: { options: number };
};

function formatProduct(p: PrismaProduct) {
  const defaultVariant = p.variants[0];

  return {
    id: p.id,
    variantId: defaultVariant?.id,
    sellerId: p.seller?.id,
    sellerSlug: p.seller?.slug,
    sellerName: p.seller?.storeName,
    name: p.name,
    slug: p.slug,
    description: p.description || "",
    brand: p.brand || undefined,
    badge: p.badge || undefined,
    rating: p.rating,
    reviews: p.reviewsCount,
    sold: p.sold,
    freeShipping: p.freeShipping,
    categoryId: p.category?.slug || "",
    categoryName: p.category?.name || "",
    price: defaultVariant ? Number(defaultVariant.price) : 0,
    oldPrice: defaultVariant?.discountPrice
      ? Number(defaultVariant.discountPrice)
      : undefined,
    images: p.images.map((img) => img.url),
    stock: defaultVariant?.inventory?.quantity ?? 0,
    colors: undefined as string[] | undefined,
    sizes: undefined as string[] | undefined,
    hasOptions: p._count.options > 0,
  };
}

const productInclude = {
  images: { orderBy: { order: "asc" as const } },
  category: { select: { slug: true, name: true } },
  seller: { select: { id: true, slug: true, storeName: true } },
  variants: {
    where: { isDefault: true },
    include: { inventory: { select: { quantity: true } } },
  },
  _count: { select: { options: true } },
};

const productDetailInclude = {
  images: { orderBy: { order: "asc" as const } },
  category: { select: { slug: true, name: true } },
  seller: { select: { id: true, slug: true, storeName: true } },
  options: {
    orderBy: { order: "asc" as const },
    include: {
      values: { orderBy: { order: "asc" as const } },
    },
  },
  variants: {
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" as const }, { id: "asc" as const }],
    include: {
      inventory: { select: { quantity: true, reservedQuantity: true } },
      optionValues: {
        include: {
          optionValue: {
            include: { option: true },
          },
        },
      },
    },
  },
};

const publicProductWhere = {
  status: "ACTIVE" as const,
  deletedAt: null,
  seller: {
    status: "ACTIVE" as const,
    deletedAt: null,
  },
};

type FullDetail = {
  id: number;
  productCode: string;
  sellerId: number;
  sellerSlug: string;
  sellerName: string;
  name: string;
  slug: string;
  description: string;
  brand?: string;
  badge?: string;
  rating: number;
  reviews: number;
  sold: number;
  freeShipping: boolean;
  categoryId: string;
  categoryName: string;
  images: string[];
  options: Array<{
    id: number;
    categoryAttributeId: number | null;
    name: string;
    type: string;
    order: number;
    values: Array<{
      id: number;
      value: string;
      colorHex: string | null;
      order: number;
    }>;
  }>;
  variants: Array<{
    id: number;
    sku: string;
    price: number;
    oldPrice: number | null;
    stock: number;
    available: number;
    isDefault: boolean;
    optionsHash: string;
    optionValueIds: number[];
    optionValueLabels: string[];
  }>;
};

export const ProductService = {
  async getAll() {
    const products = await prisma.product.findMany({
      where: publicProductWhere,
      include: productInclude,
      orderBy: { createdAt: "desc" },
    });
    return products.map(formatProduct);
  },

  async getBySlug(slug: string) {
    const product = await prisma.product.findFirst({
      where: { slug, ...publicProductWhere },
      include: productInclude,
    });
    if (!product) return null;
    return formatProduct(product);
  },

  async getBySlugAndSeller(productSlug: string, sellerSlug: string) {
    const product = await prisma.product.findFirst({
      where: {
        slug: productSlug,
        seller: {
          slug: sellerSlug,
          status: "ACTIVE",
          deletedAt: null,
        },
        status: "ACTIVE",
        deletedAt: null,
      },
      include: productInclude,
    });
    if (!product) return null;
    return formatProduct(product);
  },

  async getFullDetail(
    productSlug: string,
    sellerSlug: string
  ): Promise<FullDetail | null> {
    const product = await prisma.product.findFirst({
      where: {
        slug: productSlug,
        seller: {
          slug: sellerSlug,
          status: "ACTIVE",
          deletedAt: null,
        },
        status: "ACTIVE",
        deletedAt: null,
      },
      include: productDetailInclude,
    });

    if (!product) return null;

    const attrIds = product.options
      .map((o) => o.categoryAttributeId)
      .filter((x): x is number => x !== null);

    const catAttrs =
      attrIds.length > 0
        ? await prisma.categoryAttribute.findMany({
            where: { id: { in: attrIds } },
            include: { values: true },
          })
        : [];

    const attrLookup = new Map<
      number,
      { type: string; colorByValue: Map<string, string | null> }
    >();
    for (const attr of catAttrs) {
      const colorByValue = new Map<string, string | null>();
      for (const v of attr.values) {
        colorByValue.set(v.value, v.colorHex);
      }
      attrLookup.set(attr.id, { type: attr.type, colorByValue });
    }

    const options = product.options.map((o) => {
      const lookup = o.categoryAttributeId
        ? attrLookup.get(o.categoryAttributeId)
        : null;
      return {
        id: o.id,
        categoryAttributeId: o.categoryAttributeId,
        name: o.name,
        type: lookup?.type || "select",
        order: o.order,
        values: o.values.map((v) => ({
          id: v.id,
          value: v.value,
          colorHex: lookup?.colorByValue.get(v.value) || null,
          order: v.order,
        })),
      };
    });

    const variants = product.variants.map((v) => {
      const optionValueIds: number[] = [];
      const optionValueLabels: string[] = [];
      const sortedOV = [...v.optionValues].sort(
        (a, b) =>
          (a.optionValue.option.order ?? 0) -
          (b.optionValue.option.order ?? 0)
      );
      for (const ov of sortedOV) {
        optionValueIds.push(ov.optionValueId);
        optionValueLabels.push(ov.optionValue.value);
      }

      const qty = v.inventory?.quantity ?? 0;
      const reserved = v.inventory?.reservedQuantity ?? 0;

      return {
        id: v.id,
        sku: v.sku,
        price: Number(v.price),
        oldPrice: v.discountPrice ? Number(v.discountPrice) : null,
        stock: qty,
        available: Math.max(0, qty - reserved),
        isDefault: v.isDefault,
        optionsHash: v.optionsHash,
        optionValueIds,
        optionValueLabels,
      };
    });

    return {
      id: product.id,
      productCode: product.productCode,
      sellerId: product.seller?.id || 0,
      sellerSlug: product.seller?.slug || "",
      sellerName: product.seller?.storeName || "",
      name: product.name,
      slug: product.slug,
      description: product.description || "",
      brand: product.brand || undefined,
      badge: product.badge || undefined,
      rating: product.rating,
      reviews: product.reviewsCount,
      sold: product.sold,
      freeShipping: product.freeShipping,
      categoryId: product.category?.slug || "",
      categoryName: product.category?.name || "",
      images: product.images.map((img) => img.url),
      options,
      variants,
    };
  },

  async getFeatured(limit = 8) {
    const products = await prisma.product.findMany({
      where: publicProductWhere,
      include: productInclude,
      orderBy: { sold: "desc" },
      take: limit,
    });
    return products.map(formatProduct);
  },

  async getByCategory(categorySlug: string, limit = 20) {
    const products = await prisma.product.findMany({
      where: {
        ...publicProductWhere,
        category: { slug: categorySlug },
      },
      include: productInclude,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return products.map(formatProduct);
  },

  async search(query: string) {
    const q = query.trim();
    if (!q) return this.getAll();

    const products = await prisma.product.findMany({
      where: {
        ...publicProductWhere,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
        ],
      },
      include: productInclude,
      orderBy: { sold: "desc" },
      take: 30,
    });
    return products.map(formatProduct);
  },

  // ═══════════════════════════════════════════
  // ⭐ الدالة الجديدة — الخطوة 3
  // ═══════════════════════════════════════════
  async getFavoritesByUser(userId: number) {
    const favorites = await prisma.favorite.findMany({
      where: {
        userId,
        product: {
          status: "ACTIVE",
          deletedAt: null,
          seller: {
            status: "ACTIVE",
            deletedAt: null,
          },
        },
      },
      include: {
        product: {
          include: productInclude,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return favorites.map((f) => formatProduct(f.product as any));
  },
};

export const CategoryService = {
  async getAll() {
    const categories = await prisma.category.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { order: "asc" },
      select: { id: true, name: true, slug: true, order: true },
    });
    return categories;
  },
};