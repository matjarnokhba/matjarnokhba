"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, ShoppingBag, ShieldCheck, ShieldAlert, ArrowLeft, Pause, Play, XCircle } from "lucide-react";

type Offer = {
  id: number;
  status: string;
  isActive: boolean;
  claimVerified: boolean;
  claimType: string;
  wholesalePrice: number;
  retailPrice: number | null;
  minOrderQty: number;
  maxOrderQty: number | null;
  unit: string;
  totalStock: number;
  availableStock: number;
  ordersCount: number;
  viewsCount: number;
  createdAt: string;
  master: { id: number; name: string; brand: string | null; images: string[]; isVerified: boolean };
  tiers: Array<{ minQty: number; maxQty: number | null; unitPrice: number }>;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "مسودة", color: "bg-gray-100 text-gray-700" },
  ACTIVE: { label: "نشط", color: "bg-green-100 text-green-700" },
  PAUSED: { label: "موقوف مؤقتًا", color: "bg-amber-100 text-amber-700" },
  CLOSED: { label: "مغلق", color: "bg-red-100 text-red-700" },
};

const CLAIM_LABEL: Record<string, string> = {
  MANUFACTURER: "مصنع", DISTRIBUTOR: "موزع", RESELLER: "معيد بيع", IMPORTER: "مستورد",
};

export default function OffersListPage() {
  const params = useParams();
  const bizId = parseInt(params.id as string);
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const q = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/business/${bizId}/offers${q}`);
      const d = await res.json();
      if (d.success) setOffers(d.items);
      else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [bizId, statusFilter]);

  async function handleAction(offerId: number, action: "activate" | "pause" | "close") {
    try {
      const res = await fetch(`/api/business/${bizId}/offers/${offerId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (d.success) await load();
      else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/business/${bizId}`} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">عروضي بالجملة</h1>
          <p className="text-sm text-gray-600">{offers.length} عرض</p>
        </div>
        <Link href={`/business/${bizId}/offers/new`} className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm hover:bg-orange-600 flex items-center gap-2">
          <Plus className="h-4 w-4" /> عرض جديد
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter("")} className={`rounded-full px-4 py-1.5 text-sm border ${!statusFilter ? "bg-orange-500 text-white border-orange-500" : "hover:bg-gray-50"}`}>الكل</button>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <button key={k} onClick={() => setStatusFilter(k)} className={`rounded-full px-4 py-1.5 text-sm border ${statusFilter === k ? "bg-orange-500 text-white border-orange-500" : "hover:bg-gray-50"}`}>
            {v.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : offers.length === 0 ? (
        <div className="rounded-xl bg-white border p-12 text-center">
          <ShoppingBag className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold mb-2">لا توجد عروض</h2>
          <p className="text-sm text-gray-600 mb-6">أنشئ عرضًا من أحد منتجاتك لبيعه في سوق الجملة</p>
          <Link href={`/business/${bizId}/offers/new`} className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3 text-white hover:bg-orange-600">
            <Plus className="h-5 w-5" /> إنشاء عرض
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((o) => {
            const st = STATUS_CONFIG[o.status] || STATUS_CONFIG.DRAFT;
            return (
              <div key={o.id} className="rounded-xl bg-white border p-4">
                <div className="flex gap-4">
                  <div className="h-24 w-24 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {o.master.images?.[0] ? (
                      <img src={o.master.images[0]} alt={o.master.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400"><ShoppingBag className="h-8 w-8" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/business/${bizId}/offers/${o.id}`} className="font-semibold hover:underline">{o.master.name}</Link>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${st.color}`}>{st.label}</span>
                          {o.claimVerified ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"><ShieldCheck className="h-3 w-3" /> موثق</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"><ShieldAlert className="h-3 w-3" /> بانتظار</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{CLAIM_LABEL[o.claimType]} {o.master.brand && `· ${o.master.brand}`}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-lg font-bold text-orange-600">{o.wholesalePrice} د.م</p>
                        <p className="text-xs text-gray-500">الوحدة</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                      <div className="rounded bg-gray-50 p-2"><p className="text-gray-500">متاح</p><p className="font-bold">{o.availableStock}</p></div>
                      <div className="rounded bg-gray-50 p-2"><p className="text-gray-500">إجمالي</p><p className="font-bold">{o.totalStock}</p></div>
                      <div className="rounded bg-gray-50 p-2"><p className="text-gray-500">طلبات</p><p className="font-bold">{o.ordersCount}</p></div>
                      <div className="rounded bg-gray-50 p-2"><p className="text-gray-500">مشاهدات</p><p className="font-bold">{o.viewsCount}</p></div>
                    </div>
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <Link href={`/business/${bizId}/offers/${o.id}`} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-gray-50">تعديل</Link>
                      {o.status === "ACTIVE" && (
                        <button onClick={() => handleAction(o.id, "pause")} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-1"><Pause className="h-3 w-3" /> إيقاف مؤقت</button>
                      )}
                      {(o.status === "PAUSED" || o.status === "DRAFT") && (
                        <button onClick={() => handleAction(o.id, "activate")} className="rounded-lg bg-green-600 text-white px-3 py-1.5 text-xs hover:bg-green-700 flex items-center gap-1"><Play className="h-3 w-3" /> تفعيل</button>
                      )}
                      {o.status !== "CLOSED" && (
                        <button onClick={() => handleAction(o.id, "close")} className="rounded-lg border border-red-300 text-red-600 px-3 py-1.5 text-xs hover:bg-red-50 flex items-center gap-1"><XCircle className="h-3 w-3" /> إغلاق</button>
                      )}
                    </div>
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