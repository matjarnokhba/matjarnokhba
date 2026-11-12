"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Package, Loader2, Edit3, Eye, AlertTriangle, QrCode,
  Tag, Settings2, ShoppingBag,
} from "lucide-react";
import OfferToWholesaleModal from "@/components/seller/OfferToWholesaleModal";

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
type WholesaleSummary = {
  wholesaleStock: number;
  offerId: number | null;
  offerStatus: string | null;
};

const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: "نشط", color: "text-green-700", bg: "bg-green-100" },
  DRAFT: { label: "مسودة", color: "text-gray-600", bg: "bg-gray-100" },
  INACTIVE: { label: "معطّل", color: "text-red-700", bg: "bg-red-100" },
};

export default function SellerProductsPage() {
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [sellerSlug, setSellerSlug] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offerModalProductId, setOfferModalProductId] = useState<number | null>(null);
  const [wholesaleSummary, setWholesaleSummary] = useState<Record<number, WholesaleSummary>>({});

  async function loadProducts() {
    setLoading(true);
    setError("");
    try {
      const [productsRes, profileRes, summaryRes] = await Promise.all([
        fetch("/api/seller/products"),
        fetch("/api/seller/profile"),
        fetch("/api/seller/products/wholesale-summary"),
      ]);

      const data = await productsRes.json();
      const profileData = await profileRes.json();
      const summaryData = await summaryRes.json();
      if (summaryData.success) setWholesaleSummary(summaryData.summary || {});

      if (!productsRes.ok || !data.success) {
        setError(data.message || "فشل التحميل");
        return;
      }

      if (profileRes.ok && profileData.success && profileData.seller) {
        setSellerSlug(profileData.seller.slug || "");
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

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
          <h2 className="mt-3 text-base font-black text-gray-900">{error}</h2>
          <button onClick={loadProducts} className="mt-4 rounded-full bg-[#ff5c00] px-6 py-2 text-xs font-bold text-white">
            إعادة المحاولة
          </button>
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-orange-100">
            <Package className="h-10 w-10 text-[#ff5c00]" />
          </div>
          <h2 className="mt-5 text-lg font-black">لا توجد منتجات</h2>
          <p className="mt-2 text-sm text-gray-500">ابدأ بإضافة أول منتج لمتجرك</p>
          <Link href="/seller/products/new" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]">
            <Plus className="h-4 w-4" />
            إضافة منتج جديد
          </Link>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {products.map((product) => {
            const statusInfo = STATUS_INFO[product.status] || STATUS_INFO.DRAFT;
            const productHref = sellerSlug ? `/product/${sellerSlug}/${product.slug}` : "#";
            const ws = wholesaleSummary[product.id];

            return (
              <div key={product.id} className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm transition hover:shadow-md">
                {/* Image + badges overlay */}
                <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                      <Package className="h-10 w-10" />
                    </div>
                  )}
                  <span className={`absolute top-1 left-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${statusInfo.bg} ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  {ws && (
                    <span className={`absolute top-1 right-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                      ws.wholesaleStock > 0
                        ? "bg-emerald-500 text-white"
                        : "bg-amber-500 text-white"
                    }`}>
                      {ws.wholesaleStock > 0 ? `جم ${ws.wholesaleStock}` : "نفد"}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-2">
                  <h3 className="line-clamp-2 text-[11px] font-black leading-tight text-gray-900 sm:text-sm">
                    {product.name}
                  </h3>
                  <p className="mt-0.5 line-clamp-1 text-[9px] text-gray-500 sm:text-[10px]">
                    {product.categoryName}
                  </p>
                  <div className="mt-1 flex items-baseline justify-between gap-1">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-sm font-black text-[#ff5c00] sm:text-base">
                        {product.price}
                      </span>
                      <span className="text-[8px] text-gray-500 sm:text-[9px]">{CURRENCY}</span>
                    </div>
                    <span className={`text-[9px] sm:text-[10px] ${product.stock === 0 ? "font-bold text-red-600" : "text-gray-600"}`}>
                      مخزون {product.stock}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="mt-1.5 flex items-center gap-0.5 border-t border-gray-100 pt-1.5 sm:gap-1">
                    <Link href={productHref} target="_blank" className="flex h-7 flex-1 items-center justify-center rounded text-gray-500 transition hover:bg-gray-50 sm:h-8" aria-label="عرض">
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                    <Link href={`/seller/products/${product.id}/ticket`} className="flex h-7 flex-1 items-center justify-center rounded text-[#ff5c00] transition hover:bg-[#fff4ed] sm:h-8" aria-label="بطاقة المنتج (QR)">
                      <QrCode className="h-3.5 w-3.5" />
                    </Link>
                    <Link href={`/seller/products/${product.id}`} className="flex h-7 flex-1 items-center justify-center rounded text-blue-600 transition hover:bg-blue-50 sm:h-8" aria-label="تعديل">
                      <Edit3 className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      onClick={() => {
                        if (ws?.offerId) {
                          window.location.href = `/wholesale/offers/${ws.offerId}`;
                        } else {
                          setOfferModalProductId(product.id);
                        }
                      }}
                      className="flex h-7 flex-1 items-center justify-center rounded text-emerald-600 transition hover:bg-emerald-50 sm:h-8"
                      aria-label="اعرض بالجملة"
                      title={ws?.offerId ? "عرض بالجملة موجود — اضغط للتفاصيل" : "اعرض بالجملة"}
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
          {offerModalProductId !== null && (
        <OfferToWholesaleModal
          productId={offerModalProductId}
          onClose={() => setOfferModalProductId(null)}
          onSuccess={(offerId) => {
            setOfferModalProductId(null);
            window.location.href = `/wholesale/offers/${offerId}`;
          }}
        />
      )}    </div>
  );
}