import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StoreClient from "./StoreClient";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://matjarnokhba.com";

// ═══════ Metadata ديناميكية ═══════
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const seller = await prisma.seller.findUnique({
    where: { slug },
    select: {
      storeName: true,
      slug: true,
      description: true,
      logo: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!seller || seller.deletedAt || seller.status !== "ACTIVE") {
    return { title: "المتجر غير موجود" };
  }

  const description =
    seller.description?.slice(0, 160) ||
    `تسوق من ${seller.storeName} على متجر نخبة — شحن سريع ودفع عند الاستلام.`;

  return {
    title: seller.storeName,
    description,
    openGraph: {
      type: "website",
      title: `${seller.storeName} | متجر نخبة`,
      description,
      images: seller.logo ? [{ url: seller.logo }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: seller.storeName,
      description,
      images: seller.logo ? [seller.logo] : undefined,
    },
    alternates: {
      canonical: `/store/${seller.slug}`,
    },
  };
}

// ═══════ Server Page ═══════
export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // ═══ جلب المتجر ═══
  const seller = await prisma.seller.findUnique({
    where: { slug },
    include: {
      user: { select: { name: true } },
      _count: {
        select: {
          products: { where: { status: "ACTIVE", deletedAt: null } },
        },
      },
    },
  });

  if (!seller || seller.deletedAt || seller.status !== "ACTIVE") {
    notFound();
  }

  // ═══ جلب منتجات المتجر ═══
  const products = await prisma.product.findMany({
    where: {
      sellerId: seller.id,
      status: "ACTIVE",
      deletedAt: null,
    },
    include: {
      images: { orderBy: { order: "asc" } },
      category: { select: { slug: true, name: true } },
      variants: {
        where: { isDefault: true },
        include: { inventory: { select: { quantity: true } } },
      },
    },
    orderBy: [{ sold: "desc" }, { createdAt: "desc" }],
    take: 60,
  });

  // ═══ تنسيق المنتجات ═══
  const formattedProducts = products.map((p) => {
    const variant = p.variants[0];
    return {
      id: p.id,
      variantId: variant?.id,
      name: p.name,
      slug: p.slug,
      description: p.description || "",
      brand: p.brand || undefined,
      badge: p.badge || undefined,
      rating: p.rating,
      reviews: p.reviewsCount,
      sold: p.sold,
      freeShipping: p.freeShipping,
      categoryId: p.category.slug,
      categoryName: p.category.name,
      price: variant ? Number(variant.price) : 0,
      oldPrice: variant?.discountPrice ? Number(variant.discountPrice) : undefined,
      images: p.images.map((img) => img.url),
      stock: variant?.inventory?.quantity ?? 0,
      colors: undefined as string[] | undefined,
      sizes: undefined as string[] | undefined,
    };
  });

  // ═══ JSON-LD ═══
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: seller.storeName,
    description: seller.description || `متجر ${seller.storeName}`,
    url: `${BASE_URL}/store/${seller.slug}`,
    image: seller.logo || undefined,
    address: seller.city
      ? {
          "@type": "PostalAddress",
          addressLocality: seller.city,
          addressCountry: "MA",
        }
      : undefined,
    aggregateRating:
      Number(seller.avgRating) > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: Number(seller.avgRating),
            reviewCount: seller.totalOrders,
          }
        : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StoreClient
        store={{
          id: seller.id,
          storeName: seller.storeName,
          slug: seller.slug,
          description: seller.description,
          logo: seller.logo,
          city: seller.city,
          region: seller.region,
          isVerified: seller.isVerified,
          avgRating: Number(seller.avgRating),
          totalOrders: seller.totalOrders,
          productCount: seller._count.products,
          createdAt: seller.createdAt.toISOString(),
        }}
        products={formattedProducts}
      />
    </>
  );
}