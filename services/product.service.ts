import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════
// تحويل صف DB → نوع Product (المستخدم في UI)
// ═══════════════════════════════════════════
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
  category: { slug: string; name: string } | null;
  images: { url: string }[];
  variants: {
    price: unknown;
    discountPrice: unknown;
    inventory: { quantity: number } | null;
  }[];
};

function formatProduct(p: PrismaProduct) {
  const defaultVariant = p.variants[0];

  return {
    id: p.id,
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

// ═══════════════════════════════════════════
// Include موحّد لكل استعلامات المنتج
// ═══════════════════════════════════════════
const productInclude = {
  images: { orderBy: { order: "asc" as const } },
  category: { select: { slug: true, name: true } },
  variants: {
    where: { isDefault: true },
    include: { inventory: { select: { quantity: true } } },
  },
};

// ═══════════════════════════════════════════
// ProductService
// ═══════════════════════════════════════════
export const ProductService = {
  // كل المنتجات النشطة
  async getAll() {
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      include: productInclude,
      orderBy: { createdAt: "desc" },
    });

    return products.map(formatProduct);
  },

  // منتج واحد بـslug
  async getBySlug(slug: string) {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: productInclude,
    });

    if (!product || product.deletedAt || product.status !== "ACTIVE") {
      return null;
    }

    return formatProduct(product);
  },

  // المنتجات المميزة (الأكثر مبيعاً)
  async getFeatured(limit = 8) {
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      include: productInclude,
      orderBy: { sold: "desc" },
      take: limit,
    });

    return products.map(formatProduct);
  },

  // منتجات حسب التصنيف (slug)
  async getByCategory(categorySlug: string, limit = 20) {
    const products = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        category: { slug: categorySlug },
      },
      include: productInclude,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return products.map(formatProduct);
  },

  // البحث
  async search(query: string) {
    const q = query.trim();
    if (!q) return this.getAll();

    const products = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
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

// ═══════════════════════════════════════════
// CategoryService (مساعد)
// ═══════════════════════════════════════════
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