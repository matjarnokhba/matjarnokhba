"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2, Search, Filter, MapPin, Package, ArrowLeft, ShoppingBag,
  Store, ChevronLeft, ChevronRight, X,
} from "lucide-react";

type Offer = {
  id: number;
  master: {
    id: number; name: string; slug: string; brand: string | null;
    images: string[]; barcode: string | null;
    category: { id: number; name: string; slug: string };
  };
  supplier: {
    id: number; displayName: string; slug: string; isVerified: boolean;
    activityType: string; city: string; region: string | null;
  };
  source: { id: number; name: string; city: string } | null;
  wholesalePrice: number; retailPrice: number | null;
  minOrderQty: number; maxOrderQty: number | null; unit: string;
  claimType: string; claimVerified: boolean;
  totalStock: number; variantCount: number;
};

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

const CLAIM_LABEL: Record<string, string> = {
  MANUFACTURER: "من المصنع", DISTRIBUTOR: "موزع", RESELLER: "إعادة بيع",
};

export default function WholesaleBrowsePage() {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async (p: number = 1) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      if (search.trim()) params.set("search", search.trim());
      if (city.trim()) params.set("city", city.trim());
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      const res = await fetch(`/api/wholesale/browse?${params.toString()}`);
      if (res.status === 401) { router.push("/login?next=/wholesale/browse"); return; }
      const data = await res.json();
      if (data.success) { setOffers(data.offers); setPagination(data.pagination); }
      else setError(data.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }, [search, city, minPrice, maxPrice, router]);

  useEffect(() => { load(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function applyFilters() { load(1); setPage(1); setShowFilters(false); }
  function clearFilters() { setSearch(""); setCity(""); setMinPrice(""); setMaxPrice(""); setTimeout(() => load(1), 0); setPage(1); }
  function goToPage(p: number) { if (!pagination) return; if (p < 1 || p > pagination.totalPages) return; setPage(p); load(p); window.scrollTo({ top: 0, behavior: "smooth" }); }

  return (
    <div className="min-h-screen bg-gray-50 p-4 py-8" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]">
          <ArrowLeft className="h-3.5 w-3.5" /> عودة للمتجر
        </Link>
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
            <ShoppingBag className="h-6 w-6 text-[#ff5c00]" /> سوق الجملة
          </h1>
          <p className="mt-1 text-sm text-gray-500">تصفح عروض المصانع والموزعين — يظهر للتجار الموثقين فقط</p>
        </div>

        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="ابحث بالاسم، الماركة، أو الباركود..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00]"
            />
          </div>
          <button onClick={() => setShowFilters((s) => !s)} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50">
            <Filter className="h-4 w-4" /> فلترة
          </button>
          <button onClick={applyFilters} className="rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#e64a00]">بحث</button>
        </div>

        {showFilters && (
          <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold">المدينة</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="الدار البيضاء..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">السعر الأدنى</label>
                <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0" min="0" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">السعر الأقصى</label>
                <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="∞" min="0" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]" />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={clearFilters} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50">
                <X className="mr-1 inline h-3 w-3" /> مسح
              </button>
              <button onClick={applyFilters} className="rounded-lg bg-[#ff5c00] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#e64a00]">تطبيق</button>
            </div>
          </div>
        )}

        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" /></div>
        ) : offers.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <Package className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">لا توجد عروض مطابقة</p>
          </div>
        ) : (
          <>
            {pagination && (
              <div className="mb-3 text-xs text-gray-500">
                {pagination.total} عرض — صفحة {pagination.page} من {pagination.totalPages}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => (
                // ✅ البطاقة = div (لا Link) — الروابط كأبناء (siblings)
                <div key={o.id} className="group flex flex-col overflow-hidden rounded-xl bg-white shadow-sm transition hover:shadow-md">
                  {/* الرابط 1: الصورة + معلومات المنتج */}
                  <Link
                    href={`/wholesale/master/${o.master.id}?offer=${o.id}`}
                    className="flex flex-1 flex-col"
                  >
                    <div className="aspect-square bg-gray-100">
                      {o.master.images[0] ? (
                        <img
                          src={o.master.images[0]}
                          alt={o.master.name}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-12 w-12 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-3 pb-0">
                      <div className="mb-1 flex items-center gap-1 text-[10px] text-gray-500">
                        <span>{o.master.category.name}</span>
                        {o.claimVerified && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                            {CLAIM_LABEL[o.claimType]}
                          </span>
                        )}
                      </div>
                      <div className="line-clamp-2 text-sm font-black text-gray-900">{o.master.name}</div>
                      {o.master.brand && (
                        <div className="mt-0.5 text-[11px] text-gray-500">{o.master.brand}</div>
                      )}
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-lg font-black text-[#ff5c00]">
                          {o.wholesalePrice.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-gray-500">د.م / {o.unit}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-gray-500">
                        الحد الأدنى: {o.minOrderQty} {o.unit}
                        {o.maxOrderQty && ` — الأقصى: ${o.maxOrderQty}`}
                      </div>
                    </div>
                  </Link>

                  {/* الرابط 2: البائع (sibling، لا تداخل) */}
                  <div className="mt-2 flex items-center justify-between border-t border-gray-100 px-3 py-2 text-[10px]">
                    <Link
                      href={`/wholesale/supplier/${o.supplier.slug}`}
                      className="flex min-w-0 items-center gap-1 text-gray-600 hover:text-[#ff5c00] hover:underline"
                    >
                      <Store className="h-3 w-3 shrink-0" />
                      <span className="truncate">{o.supplier.displayName}</span>
                    </Link>
                    <div className="flex items-center gap-1 text-gray-500">
                      <MapPin className="h-3 w-3" />
                      <span>{o.supplier.city}</span>
                    </div>
                  </div>

                  {/* المخزون (جزء من البطاقة، ليس رابطًا) */}
                  <div className="px-3 pb-2 text-[10px] text-gray-400">
                    المخزون: {o.totalStock} {o.unit}
                    {o.variantCount > 1 && ` · ${o.variantCount} خيار`}
                  </div>
                </div>
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <span className="text-xs font-bold">{page} / {pagination.totalPages}</span>
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page === pagination.totalPages}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}