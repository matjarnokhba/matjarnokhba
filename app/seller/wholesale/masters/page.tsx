"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, Plus, Package, Edit3, Trash2, ArrowLeft, Search,
  Barcode, Image as ImageIcon, Shield, AlertCircle,
} from "lucide-react";

type Master = {
  id: number;
  name: string;
  slug: string;
  brand: string | null;
  barcode: string | null;
  images: string[];
  isVerified: boolean;
  status: string;
  category: { id: number; name: string };
  variantCount: number;
  offerCount: number;
  createdAt: string;
};

export default function MastersListPage() {
  const router = useRouter();
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      // We'll call /api/wholesale/me → supplierId → need endpoint for listing own masters
      // For now, use offers endpoint to gather master IDs (temporary approach)
      // Actually — need dedicated endpoint. For now, we'll allow creating masters to be visible after offers are created.
      // BUILD: temporary — fetch all masters created by user via /api/products/master/mine (to be created)
      const res = await fetch("/api/products/master/mine");
      if (res.status === 401) { router.push("/login?next=/seller/wholesale/masters"); return; }
      const data = await res.json();
      if (data.success) setMasters(data.masters);
      else setError(data.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function deleteMaster(id: number) {
    if (!confirm("حذف هذه الهوية؟ لا يمكن التراجع.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/products/master/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) { alert(data.message); return; }
      await load();
    } finally { setBusyId(null); }
  }

  const filtered = search.trim()
    ? masters.filter((m) =>
        m.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        (m.barcode && m.barcode.includes(search.trim()))
      )
    : masters;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mx-auto max-w-4xl">
        <Link href="/seller/wholesale" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]">
          <ArrowLeft className="h-3.5 w-3.5" /> عودة للبوابة
        </Link>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">هويات المنتجات</h1>
            <p className="mt-1 text-sm text-gray-500">
              الهويات التي أنشأتها — أساس كل عروض الجملة
            </p>
          </div>
          <Link href="/seller/wholesale/masters/new" className="flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e64a00]">
            <Plus className="h-4 w-4" /> هوية جديدة
          </Link>
        </div>

        <div className="mb-4 relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الباركود..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00]"
          />
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <Package className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">
              لم تنشئ أي هوية منتج بعد
            </p>
            <p className="mt-1 text-[10px] text-gray-400">
              الهوية = المنتج الأساسي (اسم، صور، باركود، فئة). العروض تُبنى فوقها.
            </p>
            <Link href="/seller/wholesale/masters/new" className="mt-4 inline-block rounded-lg bg-[#ff5c00] px-4 py-2 text-sm font-bold text-white">
              أنشئ أول هوية
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((m) => (
              <div key={m.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {m.images[0] ? (
                      <img src={m.images[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black">{m.name}</span>
                      {m.isVerified && (
                        <span className="flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                          <Shield className="h-2.5 w-2.5" /> موثق
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                      <span>{m.category.name}</span>
                      {m.brand && <span>· {m.brand}</span>}
                      {m.barcode && (
                        <span className="flex items-center gap-1" dir="ltr">
                          <Barcode className="h-3 w-3" /> {m.barcode}
                        </span>
                      )}
                      <span>· {m.variantCount} خيار · {m.offerCount} عرض</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Link
                      href={`/seller/wholesale/masters/${m.id}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      onClick={() => deleteMaster(m.id)}
                      disabled={busyId === m.id}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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