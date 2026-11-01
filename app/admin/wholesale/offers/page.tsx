"use client";
import { useEffect, useState } from "react";
import { Loader2, ShoppingBag, X, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

type Offer = {
  id: number;
  claimType: string;
  claimProofUrl: string | null;
  claimNotes: string | null;
  wholesalePrice: number;
  createdAt: string;
  master: { id: number; name: string; brand: string | null; images: string[] };
  business: { id: number; name: string; type: string; city: string; status: string };
};

const TYPE_LABEL: Record<string, string> = { FACTORY: "مصنع", COMPANY: "شركة", SUPPLIER: "مورد", IMPORTER: "مستورد", WHOLESALE_TRADER: "تاجر جملة" };
const CLAIM_LABEL: Record<string, string> = { MANUFACTURER: "مصنع", DISTRIBUTOR: "موزع", IMPORTER: "مستورد", RESELLER: "معيد بيع" };

export default function AdminOffersPage() {
  const [items, setItems] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Offer | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/offers?pageSize=100");
      const d = await res.json();
      if (d.success) setItems(d.items);
      else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleVerify(approve: boolean) {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/offers/${selected.id}/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve, reason: approve ? null : (reason || null) }),
      });
      const d = await res.json();
      if (d.success) { setSelected(null); setReason(""); await load(); }
      else setError(d.message);
    } catch { setError("خطأ"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">مطالبات العروض</h2>
        <span className="text-sm text-gray-600">{items.length} معلقة</span>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white border p-12 text-center">
          <ShoppingBag className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600">لا توجد مطالبات معلقة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((o) => (
            <div key={o.id} className="rounded-xl bg-white border p-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  {o.master.images?.[0] ? <img src={o.master.images[0]} alt="" className="w-full h-full object-cover" /> : <ShoppingBag className="h-full w-full text-gray-300 p-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold">{o.master.name}</h3>
                  <p className="text-xs text-gray-600">{o.business.name} · {TYPE_LABEL[o.business.type]} · {o.business.city}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    مطالبة: <strong>{CLAIM_LABEL[o.claimType]}</strong> · {o.wholesalePrice} د.م
                  </p>
                  {o.claimNotes && <p className="text-xs text-gray-600 mt-1 italic">{o.claimNotes}</p>}
                  {o.claimProofUrl && <a href={o.claimProofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-600 hover:underline">عرض الإثبات</a>}
                </div>
                <button onClick={() => { setSelected(o); setReason(""); }} className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm hover:bg-orange-600">مراجعة</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between"><h2 className="text-lg font-bold">مراجعة المطالبة</h2><button onClick={() => setSelected(null)}><X className="h-5 w-5" /></button></div>
            <div className="text-sm space-y-1">
              <p><strong>المنتج:</strong> {selected.master.name}</p>
              <p><strong>النشاط:</strong> {selected.business.name} ({TYPE_LABEL[selected.business.type]})</p>
              <p><strong>نوع المطالبة:</strong> {CLAIM_LABEL[selected.claimType]}</p>
              {selected.claimNotes && <p><strong>ملاحظات:</strong> {selected.claimNotes}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">سبب الرفض</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full rounded-lg border p-2 text-sm" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => handleVerify(false)} disabled={submitting} className="rounded-lg bg-red-500 text-white px-4 py-2 text-sm hover:bg-red-600 flex items-center gap-1">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} رفض
              </button>
              <button onClick={() => handleVerify(true)} disabled={submitting} className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700 flex items-center gap-1">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} توثيق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}