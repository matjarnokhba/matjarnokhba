import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import ProductWizard from "@/components/seller/product-wizard/ProductWizard";

export const dynamic = "force-dynamic";

export default async function EditAdminProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = parseInt(id);
  if (isNaN(productId)) notFound();

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      images: { orderBy: { order: "asc" } },
      category: { select: { name: true } },
      variants: {
        orderBy: { id: "asc" },
        include: {
          inventory: { select: { quantity: true } },
          optionValues: {
            select: {
              optionValue: {
                select: {
                  id: true,
                  value: true,
                  option: { select: { id: true, name: true, categoryAttributeId: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!product || product.deletedAt) notFound();

  const defaultVariant =
    product.variants.find((v) => v.isDefault) || product.variants[0];
  const hasVariants = product.variants.length > 1;

  const variantsData = product.variants.map((v) => ({
    id: v.id,
    price: Number(v.price),
    stock: v.inventory?.quantity || 0,
    barcode: v.barcode || "",
    isDefault: v.isDefault,
    options: v.optionValues.map((ov) => ({
      attributeId: ov.optionValue.option.categoryAttributeId,
      attributeName: ov.optionValue.option.name,
      valueId: ov.optionValue.id,
      value: ov.optionValue.value,
    })),
  }));

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 pb-8 pt-16 sm:px-4 lg:px-8 lg:pt-8">
      <Link
        href="/admin/products"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع إلى المنتجات
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">تعديل المنتج</h1>
        <p className="mt-1 text-sm text-gray-500">{product.name}</p>
      </div>

      <ProductWizard
        mode="edit"
        role="admin"
        productId={product.id}
        apiUrl="/api/admin/products"
        returnUrl="/admin/products"
        hasVariants={hasVariants}
        initialData={{
          categoryId: product.categoryId,
          categoryName: product.category?.name || "",
          categorySlug: "",
          name: product.name,
          slug: product.slug,
          description: product.description || "",
          brand: product.brand || "",
          badge: product.badge || "",
          originCountry: product.originCountry || "",
          videoUrl: product.videoUrl || "",
          imageUrls: product.images.map((img) => img.url),
          price: defaultVariant ? Number(defaultVariant.price).toString() : "0",
          oldPrice: defaultVariant?.discountPrice
            ? Number(defaultVariant.discountPrice).toString()
            : "",
          stock: defaultVariant?.inventory?.quantity?.toString() || "0",
          barcode: defaultVariant?.barcode || "",
          freeShipping: product.freeShipping,
          minOrderQty: product.minOrderQty.toString(),
          maxOrderQty: product.maxOrderQty?.toString() || "",
          selectedValues: {},
          variantData: {},
          existingVariants: variantsData,
        }}
      />
    </div>
  );
}