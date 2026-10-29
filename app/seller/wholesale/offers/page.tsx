"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Package, Edit3, Trash2, ArrowLeft, Search } from "lucide-react";

type Offer = {
  id: number;
  master: { id: number; name: string; slug: string; images: string[]; barcode: string | null; brand: string | null };
  source: { id: number; name: string; city: string } | null;
  wholesalePrice: number; retailPrice: number | null;
  minOrderQty: number; maxOrderQty: number | null; unit: string;
  claimType: string; claimVerified: boolean; isActive: boolean;
  variantCount: number; totalStock: number; ordersCount: number;
  createdAt: string;
};

export default function OffersListPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/wholesale/offers");
      if (res.status === 401) { router.push("/login?next=/seller/wholesale/offers"); return; }
      if (res.status === 403) { const d = await res.json(); setError(d.message || "غير مصرح"); return; }
      const data = await res.json();
      if (data.success) setOffers(data.offers);
      else setError(data.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function deleteOffer(id: number) {
    if (!confirm("حذف هذا العرض؟")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/wholesale/offers/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) { alert(data.message); return; }
      await load();
    } finally { setBusyId(null); }
  }

  async function toggleActive(offer: Offer) {
    setBusyId(offer.id);
    try {
      const res = await fetch(`/api/wholesale/offers/${offer.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !offer.isActive }),
      });
      if (res.ok) await load();
    } finally { setBusyId(null); }
  }

  const filtered = search.trim() ? offers.filter((o) => o.master.name.toLowerCase().includes(search.trim().toLowerCase())) : offers;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mx-auto max-w-4xl">
        <Link href="/seller/wholesale" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]"><ArrowLeft className="h-3.5 w-3.5" /> عودة للبوابة</Link>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">عروضي بالجملة</h1>
            <p className="mt-1 text-sm text-gray-500">إدارة المنتجات التي تعرضها للتجار</p>
          </div>
          <Link href="/seller/wholesale/offers/new" className="flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e64a00]"><Plus className="h-4 w-4" /> عرض جديد</Link>
        </div>
        <div className="mb-4 relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باسم المنتج..." className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00]" />
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <Package className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">لا توجد عروض بعد</p>
            <Link href="/seller/wholesale/offers/new" className="mt-4 inline-block rounded-lg bg-[#ff5c00] px-4 py-2 text-sm font-bold text-white">أضف عرضك الأول</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((o) => (
              <div key={o.id} className={`rounded-xl bg-white p-4 shadow-sm ${!o.isActive ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {o.master.images[0] ? <img src={o.master.images[0]} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-6 w-6 text-gray-300" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black">{o.master.name}</span>
                      {o.claimVerified && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">موثق</span>}
                      {!o.isActive && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold text-gray-700">معطّل</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                      <span>{o.wholesalePrice.toFixed(2)} د.م / {o.unit}</span>
                      <span>· الحد الأدنى: {o.minOrderQty}</span>
                      <span>· المخزون: {o.totalStock}</span>
                      {o.source && <span>· {o.source.name}</span>}
                      {o.ordersCount > 0 && <span className="text-[#ff5c00]">· {o.ordersCount} طلب</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => toggleActive(o)} disabled={busyId === o.id} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">{o.isActive ? "تعطيل" : "تفعيل"}</button>
                    <Link href={`/seller/wholesale/offers/${o.id}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"><Edit3 className="h-3.5 w-3.5" /></Link>
                    <button onClick={() => deleteOffer(o.id)} disabled={busyId === o.id} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}