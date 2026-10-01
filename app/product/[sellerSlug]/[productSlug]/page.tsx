import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductService } from "@/services/product.service";
import ProductClient from "./ProductClient";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://matjarnokhba.com";

// ═══════ Metadata ديناميكية ═══════
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sellerSlug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { sellerSlug, productSlug } = await params;
  const product = await ProductService.getBySlugAndSeller(
    productSlug,
    sellerSlug
  );

  if (!product) {
    return { title: "المنتج غير موجود" };
  }

  const firstImage = product.images[0];
  const description =
    product.description?.slice(0, 160) ||
    `اشترِ ${product.name} من متجر ${product.sellerName || "نخبة"} بأفضل سعر في المغرب.`;

  return {
    title: product.name,
    description,
    openGraph: {
      type: "website",
      title: `${product.name} | ${product.sellerName || "متجر نخبة"}`,
      description,
      images: firstImage ? [{ url: firstImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      images: firstImage ? [firstImage] : undefined,
    },
    alternates: {
      canonical: `/product/${sellerSlug}/${productSlug}`,
    },
  };
}

// ═══════ الصفحة (Server) ═══════
export default async function ProductPage({
  params,
}: {
  params: Promise<{ sellerSlug: string; productSlug: string }>;
}) {
  const { sellerSlug, productSlug } = await params;
  const product = await ProductService.getBySlugAndSeller(
    productSlug,
    sellerSlug
  );

  if (!product) notFound();

  // JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.images,
    description: product.description || product.name,
    sku: `PROD-${product.id}`,
    brand: product.brand
      ? { "@type": "Brand", name: product.brand }
      : undefined,
    aggregateRating:
      product.reviews > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviews,
          }
        : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "MAD",
      price: product.price,
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: `${BASE_URL}/product/${sellerSlug}/${productSlug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductClient />
    </>
  );
}