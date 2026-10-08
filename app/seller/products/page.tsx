"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Package,
  Loader2,
  Edit3,
  Eye,
  AlertTriangle,
  QrCode,
} from "lucide-react";

type SellerProduct = {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  categoryName: string;
  price: number;
  stock: number;
  status: string;
  sold: number;
  createdAt: string;
};

const CURRENCY = "د.م";

const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: "نشط", color: "text-green-700", bg: "bg-green-100" },
  DRAFT: { label: "مسودة", color: "text-gray-600", bg: "bg-gray-100" },
  INACTIVE: { label: "معطّل", color: "text-red-700", bg: "bg-red-100" },
};

export default function SellerProductsPage() {
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadProducts() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/seller/products");
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحميل");
        return;
      }

      setProducts(data.products);
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* ═══ Header ═══ */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">منتجاتي</h1>
          <p className="mt-1 text-sm text-gray-500">
            {loading ? "جاري التحميل..." : `${products.length} منتج`}
          </p>
        </div>
        <Link
          href="/seller/products/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00]"
        >
          <Plus className="h-4 w-4" />
          إضافة منتج
        </Link>
      </div>

      {/* ═══ Loading ═══ */}
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      )}

      {/* ═══ Error ═══ */}
      {!loading && error && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
          <h2 className="mt-3 text-base font-black text-gray-900">{error}</h2>
          <button
            onClick={loadProducts}
            className="mt-4 rounded-full bg-[#ff5c00] px-6 py-2 text-xs font-bold text-white"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* ═══ Empty ═══ */}
      {!loading && !error && products.length === 0 && (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-orange-100">
            <Package className="h-10 w-10 text-[#ff5c00]" />
          </div>
          <h2 className="mt-5 text-lg font-black">لا توجد منتجات</h2>
          <p className="mt-2 text-sm text-gray-500">
            ابدأ بإضافة أول منتج لمتجرك
          </p>
          <Link
            href="/seller/products/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
          >
            <Plus className="h-4 w-4" />
            إضافة منتج جديد
          </Link>
        </div>
      )}

      {/* ═══ List ═══ */}
      {!loading && !error && products.length > 0 && (
        <div className="space-y-3">
          {products.map((product) => {
            const statusInfo =
              STATUS_INFO[product.status] || STATUS_INFO.DRAFT;
            return (
              <div
                key={product.id}
                className="rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-4">
                  {/* صورة */}
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <Package className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  {/* معلومات */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="line-clamp-1 text-sm font-black text-gray-900">
                        {product.name}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusInfo.bg} ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                      <span>{product.categoryName}</span>
                      <span>·</span>
                      <span>
                        المخزون:{" "}
                        <strong
                          className={
                            product.stock === 0 ? "text-red-600" : ""
                          }
                        >
                          {product.stock}
                        </strong>
                      </span>
                      <span>·</span>
                      <span>{product.sold} مبيع</span>
                    </div>
                  </div>

                  {/* السعر */}
                  <div className="shrink-0 text-left">
                    <div className="text-lg font-black text-[#ff5c00]">
                      {product.price}
                    </div>
                    <div className="text-[10px] text-gray-500">{CURRENCY}</div>
                  </div>

                  {/* أزرار */}
                  <div className="flex shrink-0 gap-1">
                    <Link
                      href={`/product/${product.slug}`}
                      target="_blank"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-50"
                      aria-label="عرض"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/seller/products/${product.id}/ticket`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[#ff5c00] transition hover:bg-[#fff4ed]"
                      aria-label="بطاقة المنتج (QR)"
                    >
                      <QrCode className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/seller/products/${product.id}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50"
                      aria-label="تعديل"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}