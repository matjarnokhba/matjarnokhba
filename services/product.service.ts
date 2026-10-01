import { prisma } from "@/lib/prisma";

// ═══════ Prisma type ═══════
type PrismaProduct = {
  id: number;
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
  };
}

// ═══════ Include موحّد ═══════
const productInclude = {
  images: { orderBy: { order: "asc" as const } },
  category: { select: { slug: true, name: true } },
  seller: { select: { id: true, slug: true, storeName: true } },
  variants: {
    where: { isDefault: true },
    include: { inventory: { select: { quantity: true } } },
  },
};

// ═══════ شروط العرض العام ═══════
const publicProductWhere = {
  status: "ACTIVE" as const,
  deletedAt: null,
  seller: {
    status: "ACTIVE" as const,
    deletedAt: null,
  },
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

  // ⚠️ بحث بـ slug فقط (deprecated — قد يُرجع نتيجة غير دقيقة)
  async getBySlug(slug: string) {
    const product = await prisma.product.findFirst({
      where: { slug, ...publicProductWhere },
      include: productInclude,
    });
    if (!product) return null;
    return formatProduct(product);
  },

  // ✅ الجديدة: بحث دقيق بـ sellerSlug + productSlug
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