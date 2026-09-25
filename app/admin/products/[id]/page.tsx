import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EditProductForm from "@/components/admin/EditProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = parseInt(id);
  if (isNaN(productId)) notFound();

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: { orderBy: { order: "asc" } },
        variants: {
          where: { isDefault: true },
          include: { inventory: { select: { quantity: true } } },
        },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!product || product.deletedAt) notFound();

  const variant = product.variants[0];

  const initialData = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description || "",
    brand: product.brand || "",
    badge: product.badge || "",
    categoryId: product.categoryId.toString(),
    price: variant ? Number(variant.price).toString() : "0",
    oldPrice: variant?.discountPrice
      ? Number(variant.discountPrice).toString()
      : "",
    stock: variant?.inventory?.quantity?.toString() || "0",
    imageUrls: product.images.map((img) => img.url),
    freeShipping: product.freeShipping,
  };

  return <EditProductForm initialData={initialData} categories={categories} />;
}