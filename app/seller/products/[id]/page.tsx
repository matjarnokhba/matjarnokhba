"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, AlertCircle, History as HistoryIcon } from "lucide-react";
import ProductWizard from "@/components/seller/product-wizard/ProductWizard";
import type { ExistingVariant } from "@/components/seller/product-wizard/types";

type ProductData = {
  id: number;
  name: string;
  slug: string;
  description: string;
  brand: string;
  badge: string;
  categoryId: number;
  categoryName: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  barcode: string;
  freeShipping: boolean;
  imageUrls: string[];
  originCountry: string;
  videoUrl: string;
  minOrderQty: number;
  maxOrderQty: number | null;
  hasVariants: boolean;
  status: string;
  variants: ExistingVariant[];
  selectedValues: Record<number, number[]>;
  updatedAt: string;
};

export default function EditSellerProductPage() {
  const params = useParams();
  const productId = parseInt(params.id as string);
  const [data, setData] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/seller/products/${productId}`);
        const json = await res.json();
        if (!json.success) {
          setError(json.message || "المنتج غير موجود");
          return;
        }
        setData(json.product);
      } catch {
        setError("فشل الاتصال بالخادم");
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="mx-auto max-w-md rounded-xl bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
          <p className="mt-3 text-sm font-bold text-red-700">
            {error || "المنتج غير موجود"}
          </p>
          <Link
            href="/seller/products"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2 text-sm font-bold text-white hover:bg-[#e64a00]"
          >
            <ArrowRight className="h-4 w-4" />
            عودة للمنتجات
          </Link>
        </div>
      </div>
    );
  }

  const defaultVariant =
    data.variants.find((v) => v.isDefault) || data.variants[0];

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 pb-8 pt-16 sm:px-4 lg:px-8 lg:pt-8">
      <Link
        href="/seller/products"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع إلى منتجاتي
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">تعديل المنتج</h1>
          <p className="mt-1 text-sm text-gray-500">{data.name}</p>
        </div>
        <Link
          href={`/seller/products/${productId}/history`}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
        >
          <HistoryIcon className="h-3.5 w-3.5" />
          سجل التعديلات
        </Link>
      </div>

      <ProductWizard
        mode="edit"
        role="seller"
        productId={productId}
        apiUrl="/api/seller/products"
        returnUrl="/seller/products"
        hasVariants={data.hasVariants}
        productStatus={data.status}
        initialData={{
          categoryId: data.categoryId,
          categoryName: data.categoryName,
          categorySlug: "",
          name: data.name,
          slug: data.slug,
          description: data.description || "",
          brand: data.brand || "",
          badge: data.badge || "",
          originCountry: data.originCountry || "",
          videoUrl: data.videoUrl || "",
          imageUrls: data.imageUrls,
          price: defaultVariant ? defaultVariant.price.toString() : "0",
          oldPrice: data.oldPrice ? data.oldPrice.toString() : "",
          stock: defaultVariant ? defaultVariant.stock.toString() : "0",
          reservedQuantity: defaultVariant?.reservedQuantity || 0,
          barcode: defaultVariant?.barcode || data.barcode || "",
          freeShipping: data.freeShipping,
          minOrderQty: data.minOrderQty.toString(),
          maxOrderQty: data.maxOrderQty ? data.maxOrderQty.toString() : "",
          selectedValues: data.selectedValues || {},
          variantData: {},
          existingVariants: data.variants || [],
          expectedUpdatedAt: data.updatedAt,
        }}
      />
    </div>
  );
}