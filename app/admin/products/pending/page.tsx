"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Package,
  CheckCircle2,
  XCircle,
  Store,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

type PendingProduct = {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  categoryName: string;
  price: number;
  stock: number;
  createdAt: string;
  seller: { id: number; storeName: string; slug: string };
};

const CURRENCY = "د.م";

export default function AdminPendingProductsPage() {
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products/pending");
      const data = await res.json();
      if (data.success) setProducts(data.products);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAction(
    productId: number,
    action: "approve" | "reject"
  ) {
    setActionId(productId);
    try {
      const res = await fetch(`/api/admin/products/${productId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "فشل الإجراء");
        return;
      }

      await loadData();
    } catch (err) {
      console.error(err);
      alert("فشل الاتصال");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">
          منتجات بانتظار الموافقة
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          راجع منتجات التجار ووافق عليها لنشرها في المتجر
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h3 className="mt-5 text-lg font-black">لا توجد منتجات معلّقة</h3>
          <p className="mt-2 text-sm text-gray-500">
            كل المنتجات تمت مراجعتها
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="rounded-xl bg-white p-4 shadow-sm"
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
                  <div className="text-sm font-black text-gray-900">
                    {product.name}
                  </div>

                  <Link
                    href={`/store/${product.seller.slug}`}
                    target="_blank"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    <Store className="h-3 w-3" />
                    {product.seller.storeName}
                  </Link>

                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
                    <span>{product.categoryName}</span>
                    <span>·</span>
                    <span>
                      المخزون: <strong>{product.stock}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      {new Date(product.createdAt).toLocaleDateString("ar-MA", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
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
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/product/${product.seller.slug}/${product.slug}`}
                    target="_blank"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-50"
                    title="معاينة المنتج"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleAction(product.id, "approve")}
                    disabled={actionId === product.id}
                    className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionId === product.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    موافقة
                  </button>
                  <button
                    onClick={() => handleAction(product.id, "reject")}
                    disabled={actionId === product.id}
                    className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    رفض
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}