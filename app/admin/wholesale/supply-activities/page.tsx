"use client";
import { useEffect, useState } from "react";
import { Loader2, Layers, X, CheckCircle2, XCircle, Building2 } from "lucide-react";

type Item = {
  id: number;
  type: string;
  name: string;
  legalName: string | null;
  city: string;
  commercialRegister: string | null;
  taxId: string | null;
  createdAt: string;
  business: { id: number; name: string; type: string; status: string; city: string };
};

const TYPE_LABEL: Record<string, string> = { FACTORY: "مصنع", COMPANY: "شركة", SUPPLIER: "مورد", IMPORTER: "مستورد", TRADER: "تاجر جملة" };

export default function AdminSupplyActivitiesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/supply-activities?pageSize=100");
      const d = await res.json();
      if (d.success) setItems(d.items);
      else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function handleVerify(approve: boolean) {
    if (!selected) return;
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`/api/admin/supply-activities/${selected.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve, reason: approve ? null : (reason || null) }),
      });
      const d = await res.json();
      if (d.success) { setSelected(null); setReason(""); await load(); }
      else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Layers className="h-6 w-6 text-orange-500" /> الهويات التجارية</h2>
          <p className="text-sm text-gray-600">{items.length} هوية بانتظار التوثيق</p>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white border p-12 text-center">
          <Layers className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600">لا توجد هويات بانتظار التوثيق</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="rounded-xl bg-white border p-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold">{it.name}</h3>
                  <p className="text-xs text-gray-600">{TYPE_LABEL[it.type] || it.type} · {it.city}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    النشاط: <span className="font-medium">{it.business.name}</span> ({TYPE_LABEL[it.business.type] || it.business.type})
                  </p>
                  {it.commercialRegister && <p className="text-xs text-gray-500">السجل: {it.commercialRegister}</p>}
                </div>
                <button onClick={() => { setSelected(it); setReason(""); }} className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm hover:bg-orange-600">مراجعة</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between"><h2 className="text-lg font-bold">مراجعة هوية</h2><button onClick={() => setSelected(null)}><X className="h-5 w-5" /></button></div>
            <div className="text-sm space-y-1">
              <p><strong>الاسم:</strong> {selected.name}</p>
              <p><strong>النوع:</strong> {TYPE_LABEL[selected.type] || selected.type}</p>
              <p><strong>النشاط الأم:</strong> {selected.business.name}</p>
              <p><strong>المدينة:</strong> {selected.city}</p>
              {selected.legalName && <p><strong>الاسم القانوني:</strong> {selected.legalName}</p>}
              {selected.commercialRegister && <p><strong>السجل التجاري:</strong> {selected.commercialRegister}</p>}
              {selected.taxId && <p><strong>الرقم الضريبي:</strong> {selected.taxId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">سبب الرفض (إن رفضت)</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full rounded-lg border p-2 text-sm" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => handleVerify(false)} disabled={submitting} className="rounded-lg bg-red-500 text-white px-4 py-2 text-sm hover:bg-red-600 flex items-center gap-1">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} رفض
              </button>
              <button onClick={() => handleVerify(true)} disabled={submitting} className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700 flex items-center gap-1">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} توثيق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}