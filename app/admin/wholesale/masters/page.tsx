"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Package, ShieldCheck, ShieldAlert, X, CheckCircle2, XCircle } from "lucide-react";

type Master = {
  id: number;
  name: string;
  brand: string | null;
  images: string[];
  barcode: string | null;
  isVerified: boolean;
  createdAt: string;
  category: { id: number; name: string };
  createdByBusiness: { id: number; name: string; type: string; city: string; status: string };
  _count: { variants: number; wholesaleOffers: number };
};

const TYPE_LABEL: Record<string, string> = { FACTORY: "مصنع", COMPANY: "شركة", SUPPLIER: "مورد", IMPORTER: "مستورد", WHOLESALE_TRADER: "تاجر جملة" };

function MastersList() {
  const search = useSearchParams();
  const [status, setStatus] = useState(search.get("status") || "pending");
  const [items, setItems] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Master | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/admin/masters?status=${status}`);
      const d = await res.json();
      if (d.success) setItems(d.items);
      else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [status]);

  async function handleVerify(approve: boolean) {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/masters/${selected.id}/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve }),
      });
      const d = await res.json();
      if (d.success) { setSelected(null); await load(); }
      else setError(d.message);
    } catch { setError("خطأ"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">المنتجات</h2>
        <div className="flex gap-2">
          <button onClick={() => setStatus("pending")} className={`rounded-full px-3 py-1 text-xs border ${status === "pending" ? "bg-orange-500 text-white border-orange-500" : ""}`}>بانتظار التوثيق</button>
          <button onClick={() => setStatus("verified")} className={`rounded-full px-3 py-1 text-xs border ${status === "verified" ? "bg-orange-500 text-white border-orange-500" : ""}`}>موثقة</button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white border p-12 text-center">
          <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600">لا توجد منتجات</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((m) => (
            <div key={m.id} className="rounded-xl bg-white border p-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  {m.images?.[0] ? <img src={m.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="h-full w-full text-gray-300 p-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold">{m.name}</h3>
                    {m.isVerified ? <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"><ShieldCheck className="h-3 w-3" /> موثق</span> : <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"><ShieldAlert className="h-3 w-3" /> بانتظار</span>}
                  </div>
                  {m.brand && <p className="text-xs text-gray-600">{m.brand}</p>}
                  <p className="text-xs text-gray-600">{m.createdByBusiness.name} · {TYPE_LABEL[m.createdByBusiness.type]} · {m.createdByBusiness.city}</p>
                  <p className="text-xs text-gray-500 mt-1">{m.category.name} · {m._count.variants} متغير · {m._count.wholesaleOffers} عرض</p>
                </div>
                {!m.isVerified && (
                  <button onClick={() => setSelected(m)} className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm hover:bg-orange-600">مراجعة</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between"><h2 className="text-lg font-bold">مراجعة المنتج</h2><button onClick={() => setSelected(null)}><X className="h-5 w-5" /></button></div>
            {selected.images?.[0] && <img src={selected.images[0]} alt="" className="w-full aspect-square object-cover rounded-lg max-h-64" />}
            <div className="text-sm space-y-1">
              <p><strong>الاسم:</strong> {selected.name}</p>
              {selected.brand && <p><strong>العلامة:</strong> {selected.brand}</p>}
              {selected.barcode && <p><strong>الباركود:</strong> {selected.barcode}</p>}
              <p><strong>المنشئ:</strong> {selected.createdByBusiness.name}</p>
              <p><strong>النوع:</strong> {TYPE_LABEL[selected.createdByBusiness.type]}</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => handleVerify(false)} disabled={submitting} className="rounded-lg border border-red-300 text-red-600 px-4 py-2 text-sm hover:bg-red-50 flex items-center gap-1">
                <XCircle className="h-4 w-4" /> رفض
              </button>
              <button onClick={() => handleVerify(true)} disabled={submitting} className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700 flex items-center gap-1">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />} <CheckCircle2 className="h-4 w-4" /> موافقة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>}><MastersList /></Suspense>;
}