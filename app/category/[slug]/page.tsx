import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CategoryClient from "./CategoryClient";

// ═══════ Metadata ديناميكية ═══════
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const category = await prisma.category.findUnique({
    where: { slug },
    select: { name: true, slug: true, image: true },
  });

  if (!category) {
    return { title: "التصنيف غير موجود" };
  }

  const description = `تصفح ${category.name} في متجر نخبة — أفضل الأسعار في المغرب، شحن سريع 24-48 ساعة، دفع عند الاستلام.`;

  return {
    title: category.name,
    description,
    openGraph: {
      type: "website",
      title: `${category.name} | متجر نخبة`,
      description,
      images: category.image ? [{ url: category.image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: category.name,
      description,
      images: category.image ? [category.image] : undefined,
    },
    alternates: {
      canonical: `/category/${category.slug}`,
    },
  };
}

// ═══════ الصفحة (Server) ═══════
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, image: true },
  });

  if (!category || category === null) notFound();

  // التحقق من isActive + deletedAt
  const fullCategory = await prisma.category.findFirst({
    where: { slug, isActive: true, deletedAt: null },
    select: { id: true, name: true, slug: true },
  });

  if (!fullCategory) notFound();

  // JSON-LD (BreadcrumbList)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.name} | متجر نخبة`,
    url: `/category/${category.slug}`,
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "الرئيسية",
          item: "/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: category.name,
          item: `/category/${category.slug}`,
        },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CategoryClient />
    </>
  );
}