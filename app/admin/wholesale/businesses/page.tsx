"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Building2, ShieldCheck, ShieldAlert, Clock, X, CheckCircle2, XCircle, Package, ShoppingBag } from "lucide-react";

type Business = {
  id: number;
  name: string;
  slug: string;
  type: string;
  status: string;
  city: string;
  phone: string;
  email: string | null;
  commercialRegister: string | null;
  taxId: string | null;
  logo: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  owner: { id: number; name: string; email: string };
  _count: { documents: number; productMasters: number; wholesaleOffers: number };
};

const TYPE_LABEL: Record<string, string> = { FACTORY: "مصنع", COMPANY: "شركة", SUPPLIER: "مورد", IMPORTER: "مستورد", WHOLESALE_TRADER: "تاجر جملة" };
const STATUS_LABEL: Record<string, { label: string; color: string; Icon: any }> = {
  PENDING: { label: "قيد التوثيق", color: "bg-amber-100 text-amber-700", Icon: Clock },
  VERIFIED: { label: "موثق", color: "bg-green-100 text-green-700", Icon: ShieldCheck },
  SUSPENDED: { label: "موقوف", color: "bg-red-100 text-red-700", Icon: ShieldAlert },
  REJECTED: { label: "مرفوض", color: "bg-gray-100 text-gray-700", Icon: ShieldAlert },
};

function BusinessesList() {
  const router = useRouter();
  const search = useSearchParams();
  const [status, setStatus] = useState(search.get("status") || "");
  const [items, setItems] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Business | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const q = status ? `?status=${status}` : "";
      const res = await fetch(`/api/admin/businesses${q}`);
      const d = await res.json();
      if (d.success) setItems(d.businesses);
      else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [status]);

  async function handleVerify(approve: boolean) {
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/businesses/${selected.id}/verify`, {
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
        <h2 className="text-xl font-bold">الأنشطة التجارية</h2>
        <div className="flex gap-2">
          <button onClick={() => setStatus("")} className={`rounded-full px-3 py-1 text-xs border ${!status ? "bg-orange-500 text-white border-orange-500" : ""}`}>الكل</button>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <button key={k} onClick={() => setStatus(k)} className={`rounded-full px-3 py-1 text-xs border ${status === k ? "bg-orange-500 text-white border-orange-500" : ""}`}>{v.label}</button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white border p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600">لا توجد أنشطة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((b) => {
            const st = STATUS_LABEL[b.status] || STATUS_LABEL.PENDING;
            const StIcon = st.Icon;
            return (
              <div key={b.id} className="rounded-xl bg-white border p-4">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {b.logo ? <img src={b.logo} alt="" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-gray-400"><Building2 className="h-6 w-6" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold">{b.name}</h3>
                      <span className="text-xs text-gray-500">{TYPE_LABEL[b.type]}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${st.color}`}><StIcon className="h-3 w-3" />{st.label}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{b.owner.name} · {b.owner.email}</p>
                    <p className="text-xs text-gray-500">{b.city} · {b.phone}</p>
                    <div className="flex gap-3 text-xs text-gray-500 mt-2">
                      <span>{b._count.documents} وثيقة</span>
                      <span>{b._count.productMasters} منتج</span>
                      <span>{b._count.wholesaleOffers} عرض</span>
                    </div>
                  </div>
                  {b.status === "PENDING" && (
                    <button onClick={() => { setSelected(b); setReason(""); }}
                      className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm hover:bg-orange-600">مراجعة</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">مراجعة نشاط</h2>
              <button onClick={() => setSelected(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="text-sm space-y-1">
              <p><strong>الاسم:</strong> {selected.name}</p>
              <p><strong>النوع:</strong> {TYPE_LABEL[selected.type]}</p>
              <p><strong>المالك:</strong> {selected.owner.name} ({selected.owner.email})</p>
              <p><strong>المدينة:</strong> {selected.city}</p>
              <p><strong>الهاتف:</strong> {selected.phone}</p>
              {selected.commercialRegister && <p><strong>السجل التجاري:</strong> {selected.commercialRegister}</p>}
              {selected.taxId && <p><strong>الرقم الضريبي:</strong> {selected.taxId}</p>}
              <Link href={`/business/${selected.id}`} target="_blank" className="text-orange-600 hover:underline">عرض صفحة النشاط</Link>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">سبب الرفض (إن رفضت)</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full rounded-lg border p-2 text-sm" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => handleVerify(false)} disabled={submitting} className="rounded-lg bg-red-500 text-white px-4 py-2 text-sm hover:bg-red-600 disabled:opacity-50 flex items-center gap-1">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} رفض
              </button>
              <button onClick={() => handleVerify(true)} disabled={submitting} className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} موافقة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>}><BusinessesList /></Suspense>;
}