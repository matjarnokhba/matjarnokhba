import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://matjarnokhba.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ═══ الصفحات الثابتة ═══
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/become-seller`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  try {
    // ═══ المنتجات (المسار الجديد) ═══
    const products = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        seller: {
          status: "ACTIVE",
          deletedAt: null,
        },
      },
      select: {
        slug: true,
        updatedAt: true,
        seller: { select: { slug: true } },
      },
    });

    const productPages: MetadataRoute.Sitemap = products
      .filter((p) => p.seller?.slug)
      .map((p) => ({
        // ⚠️ المسار الجديد: /product/[sellerSlug]/[productSlug]
        url: `${BASE_URL}/product/${p.seller!.slug}/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));

    // ═══ التصنيفات ═══
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    });

    const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
      url: `${BASE_URL}/category/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    // ═══ المتاجر ═══
    const sellers = await prisma.seller.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    });

    const sellerPages: MetadataRoute.Sitemap = sellers.map((s) => ({
      url: `${BASE_URL}/store/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [
      ...staticPages,
      ...productPages,
      ...categoryPages,
      ...sellerPages,
    ];
  } catch (error) {
    console.error("Sitemap error:", error);
    return staticPages;
  }
}