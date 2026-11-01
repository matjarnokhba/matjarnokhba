"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Package, ShieldCheck, ShieldAlert, ArrowLeft, Search } from "lucide-react";

type Master = {
  id: number;
  name: string;
  slug: string;
  brand: string | null;
  images: string[];
  barcode: string | null;
  isVerified: boolean;
  category: { id: number; name: string };
  _count: { variants: number; wholesaleOffers: number };
  createdAt: string;
};

export default function MastersListPage() {
  const params = useParams();
  const bizId = parseInt(params.id as string);
  const [loading, setLoading] = useState(true);
  const [masters, setMasters] = useState<Master[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => { setPage(1); }, [search]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const q = new URLSearchParams();
        if (search) q.set("search", search);
        q.set("page", String(page));
        q.set("pageSize", "24");
        const res = await fetch(`/api/business/${bizId}/masters?${q}`);
        const d = await res.json();
        if (d.success) {
          setMasters(d.items);
          setTotal(d.total);
          setTotalPages(d.totalPages);
        } else setError(d.message);
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [bizId, search, page]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/business/${bizId}`} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">منتجاتي بالجملة</h1>
          <p className="text-sm text-gray-600">{total} منتج</p>
        </div>
        <Link href={`/business/${bizId}/masters/new`} className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm hover:bg-orange-600 flex items-center gap-2">
          <Plus className="h-4 w-4" /> منتج جديد
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو العلامة أو الباركود..."
          className="w-full rounded-lg border pr-10 pl-4 py-2" />
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : masters.length === 0 ? (
        <div className="rounded-xl bg-white border p-12 text-center">
          <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold mb-2">لا توجد منتجات</h2>
          <p className="text-sm text-gray-600 mb-6">أضف منتجك الأول لعرضه في سوق الجملة</p>
          <Link href={`/business/${bizId}/masters/new`} className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3 text-white hover:bg-orange-600">
            <Plus className="h-5 w-5" /> إضافة منتج
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {masters.map((m) => (
              <Link key={m.id} href={`/business/${bizId}/masters/${m.id}`}
                className="rounded-xl bg-white border overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-square bg-gray-100">
                  {m.images?.[0] ? (
                    <img src={m.images[0]} alt={m.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400"><Package className="h-16 w-16" /></div>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="font-semibold line-clamp-2 text-sm">{m.name}</h3>
                    {m.isVerified ? (
                      <ShieldCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    )}
                  </div>
                  {m.brand && <p className="text-xs text-gray-500">{m.brand}</p>}
                  <p className="text-xs text-gray-500">{m.category.name}</p>
                  <div className="flex justify-between text-xs pt-1 border-t">
                    <span>{m._count.variants} متغير</span>
                    <span>{m._count.wholesaleOffers} عرض</span>
                  </div>
                  {!m.isVerified && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">بانتظار التوثيق</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border px-3 py-1 disabled:opacity-50">السابق</button>
              <span className="text-sm py-1">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border px-3 py-1 disabled:opacity-50">التالي</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}