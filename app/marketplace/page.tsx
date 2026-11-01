"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Loader2, Package, MapPin, Building2, ChevronLeft, ChevronRight } from "lucide-react";

type Offer = {
  id: number;
  master: { id: number; name: string; slug: string; brand: string | null; images: string[] };
  business: { id: number; name: string; slug: string; type: string; city: string; logo: string | null; status: string };
  wholesalePrice: number;
  retailPrice: number | null;
  minOrderQty: number;
  maxOrderQty: number | null;
  unit: string;
  claimType: string;
  leadTimeDays: number;
  availableStock: number;
  tiers: Array<{ minQty: number; maxQty: number | null; unitPrice: number }>;
};

const BUSINESS_TYPES = [
  { value: "INDEPENDENT_SUPPLIER", label: "مورد مستقل" },
  { value: "WHOLESALE_TRADER", label: "تاجر جملة" },
];

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [city, setCity] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => { setPage(1); }, [search, businessType, city]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (businessType) params.set("businessType", businessType);
        if (city) params.set("city", city);
        params.set("page", String(page));
        params.set("pageSize", "24");
        const res = await fetch(`/api/marketplace/offers?${params}`);
        const d = await res.json();
        if (d.success) {
          setOffers(d.items);
          setTotal(d.total);
          setTotalPages(d.totalPages);
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, [search, businessType, city, page]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white border p-5 space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن منتج أو علامة تجارية..." className="w-full rounded-lg border pr-10 pl-4 py-3" />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {BUSINESS_TYPES.map((t) => (
            <button key={t.value} onClick={() => setBusinessType(businessType === t.value ? "" : t.value)}
              className={`rounded-full px-4 py-1.5 text-sm border ${businessType === t.value ? "bg-orange-500 text-white border-orange-500" : "hover:bg-gray-50"}`}>
              {t.label}
            </button>
          ))}
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="المدينة"
            className="rounded-full border px-4 py-1.5 text-sm w-40" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : offers.length === 0 ? (
        <div className="rounded-xl bg-white border p-12 text-center">
          <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600">لا توجد عروض مطابقة</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-600">{total} نتيجة</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {offers.map((o) => (
              <Link key={o.id} href={`/marketplace/${o.id}`}
                className="rounded-xl bg-white border overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-square bg-gray-100 relative">
                  {o.master.images?.[0] ? (
                    <img src={o.master.images[0]} alt={o.master.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400"><Package className="h-16 w-16" /></div>
                  )}
                  {o.availableStock === 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-sm font-medium">نفذ المخزون</span>
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <h3 className="font-semibold line-clamp-2 min-h-[2.5rem]">{o.master.name}</h3>
                  {o.master.brand && <p className="text-xs text-gray-500">{o.master.brand}</p>}
                  <p className="text-lg font-bold text-orange-600">{o.wholesalePrice} <span className="text-sm">د.م</span></p>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>الحد الأدنى: {o.minOrderQty}</p>
                    <p>متاح: {o.availableStock}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-600 border-t pt-2">
                    <Building2 className="h-3 w-3 flex-shrink-0" />
                    <span className="line-clamp-1">{o.business.name}</span>
                    <span className="text-gray-400">·</span>
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span>{o.business.city}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg border p-2 disabled:opacity-50"><ChevronRight className="h-4 w-4" /></button>
              <span className="text-sm">صفحة {page} من {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="rounded-lg border p-2 disabled:opacity-50"><ChevronLeft className="h-4 w-4" /></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}