"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Package, Play, Pause, XCircle, ShieldCheck, ShieldAlert, Edit, Save } from "lucide-react";

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
  leadTimeDays: number;
  notes: string | null;
  claimProofUrl: string | null;
  claimNotes: string | null;
  viewsCount: number;
  ordersCount: number;
  createdAt: string;
  master: { id: number; name: string; brand: string | null; images: string[]; barcode: string | null; isVerified: boolean; categoryId: number };
  variants: Array<{ id: number; masterVariantId: number; stock: number; reserved: number; inTransit: number; availableStock: number; masterVariant: { id: number; sku: string | null; barcode: string | null; options: any } }>;
  tiers: Array<{ id: number; minQty: number; maxQty: number | null; unitPrice: number }>;
  business: { id: number; name: string; slug: string; type: string; status: string; city: string };
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "مسودة", color: "bg-gray-100 text-gray-700" },
  ACTIVE: { label: "نشط", color: "bg-green-100 text-green-700" },
  PAUSED: { label: "موقوف", color: "bg-amber-100 text-amber-700" },
  CLOSED: { label: "مغلق", color: "bg-red-100 text-red-700" },
};

export default function OfferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bizId = parseInt(params.id as string);
  const offerId = parseInt(params.offerId as string);
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [wholesalePrice, setWholesalePrice] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [minOrderQty, setMinOrderQty] = useState("");
  const [maxOrderQty, setMaxOrderQty] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/business/${bizId}/offers/${offerId}`);
      const d = await res.json();
      if (d.success) {
        setOffer(d.offer);
        setWholesalePrice(String(d.offer.wholesalePrice));
        setRetailPrice(d.offer.retailPrice ? String(d.offer.retailPrice) : "");
        setMinOrderQty(String(d.offer.minOrderQty));
        setMaxOrderQty(d.offer.maxOrderQty ? String(d.offer.maxOrderQty) : "");
        setLeadTimeDays(String(d.offer.leadTimeDays ?? 3));
        setNotes(d.offer.notes || "");
      } else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [bizId, offerId]);

  async function handleAction(action: "activate" | "pause" | "close") {
    setActionLoading(true);
    setError("");
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
    finally { setActionLoading(false); }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const body: any = {};
      const wp = parseFloat(wholesalePrice);
      if (wp && wp !== offer?.wholesalePrice) body.wholesalePrice = wp;
      const rp = parseFloat(retailPrice);
      if (rp !== (offer?.retailPrice ?? 0)) body.retailPrice = rp > 0 ? rp : null;
      const moq = parseInt(minOrderQty);
      if (moq && moq !== offer?.minOrderQty) body.minOrderQty = moq;
      const mx = maxOrderQty.trim() ? parseInt(maxOrderQty) : null;
      if (mx !== offer?.maxOrderQty) body.maxOrderQty = mx;
      const lt = parseInt(leadTimeDays);
      if (lt !== offer?.leadTimeDays) body.leadTimeDays = lt;
      if (notes !== (offer?.notes || "")) body.notes = notes || null;

      if (Object.keys(body).length === 0) { setEditing(false); setSaving(false); return; }
      const res = await fetch(`/api/business/${bizId}/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.success) { await load(); setEditing(false); }
      else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;
  if (!offer) return <div className="max-w-4xl mx-auto p-6"><div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">{error || "العرض غير موجود"}</div></div>;

  const st = STATUS_CONFIG[offer.status] || STATUS_CONFIG.DRAFT;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/business/${bizId}/offers`} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{offer.master.name}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs ${st.color}`}>{st.label}</span>
            {offer.claimVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"><ShieldCheck className="h-3 w-3" /> موثق</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"><ShieldAlert className="h-3 w-3" /> بانتظار التوثيق</span>
            )}
          </div>
          <p className="text-sm text-gray-600">{offer.master.brand || ""}</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"><Edit className="h-4 w-4" /> تعديل</button>
        )}
      </div>

      {offer.master.images?.[0] && (
        <div className="rounded-xl overflow-hidden bg-gray-100 aspect-video">
          <img src={offer.master.images[0]} alt={offer.master.name} className="w-full h-full object-cover" />
        </div>
      )}

      {editing ? (
        <div className="rounded-xl bg-white border p-5 space-y-3">
          <h2 className="font-semibold">تعديل العرض</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">سعر الجملة</label><input type="number" step="0.01" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} className="w-full rounded-lg border p-2" /></div>
            <div><label className="block text-sm font-medium mb-1">سعر التجزئة</label><input type="number" step="0.01" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} className="w-full rounded-lg border p-2" /></div>
            <div><label className="block text-sm font-medium mb-1">الحد الأدنى</label><input type="number" value={minOrderQty} onChange={(e) => setMinOrderQty(e.target.value)} className="w-full rounded-lg border p-2" /></div>
            <div><label className="block text-sm font-medium mb-1">الحد الأقصى</label><input type="number" value={maxOrderQty} onChange={(e) => setMaxOrderQty(e.target.value)} className="w-full rounded-lg border p-2" /></div>
            <div><label className="block text-sm font-medium mb-1">مدة التجهيز</label><input type="number" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} className="w-full rounded-lg border p-2" /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">ملاحظات</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border p-2" /></div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="rounded-lg border px-4 py-2 text-sm">إلغاء</button>
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm flex items-center gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} حفظ
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-white border p-5">
          <h2 className="font-semibold mb-3">السعر والشروط</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-gray-500">سعر الجملة</dt><dd className="font-bold text-lg text-orange-600">{offer.wholesalePrice} د.م</dd></div>
            {offer.retailPrice && <div><dt className="text-gray-500">سعر التجزئة المقترح</dt><dd className="font-bold">{offer.retailPrice} د.م</dd></div>}
            <div><dt className="text-gray-500">الحد الأدنى</dt><dd className="font-medium">{offer.minOrderQty}</dd></div>
            {offer.maxOrderQty && <div><dt className="text-gray-500">الحد الأقصى</dt><dd className="font-medium">{offer.maxOrderQty}</dd></div>}
            <div><dt className="text-gray-500">مدة التجهيز</dt><dd className="font-medium">{offer.leadTimeDays} أيام</dd></div>
          </dl>
          {offer.notes && <p className="mt-3 text-sm text-gray-700 bg-gray-50 p-3 rounded">{offer.notes}</p>}
        </div>
      )}

      {offer.tiers.length > 0 && (
        <div className="rounded-xl bg-white border p-5">
          <h2 className="font-semibold mb-3">شرائح الأسعار</h2>
          <div className="space-y-2">
            {offer.tiers.map((t) => (
              <div key={t.id} className="flex justify-between text-sm border-b pb-2 last:border-b-0">
                <span>{t.minQty}{t.maxQty ? ` - ${t.maxQty}` : "+"} قطعة</span>
                <span className="font-bold">{t.unitPrice} د.م</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white border p-5">
        <h2 className="font-semibold mb-3">المخزون</h2>
        <div className="space-y-2">
          {offer.variants.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{v.masterVariant.options ? Object.entries(v.masterVariant.options).map(([k, val]) => `${k}: ${val}`).join(" / ") : `#${v.masterVariantId}`}</p>
                {v.masterVariant.sku && <p className="text-xs text-gray-500 font-mono">{v.masterVariant.sku}</p>}
              </div>
              <div className="flex gap-4 text-xs">
                <div className="text-center"><p className="text-gray-500">متاح</p><p className="font-bold text-green-600">{v.availableStock}</p></div>
                <div className="text-center"><p className="text-gray-500">محجوز</p><p className="font-bold text-amber-600">{v.reserved}</p></div>
                <div className="text-center"><p className="text-gray-500">في الطريق</p><p className="font-bold text-blue-600">{v.inTransit}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-white border p-5">
        <h2 className="font-semibold mb-3">إحصاءات</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-gray-500">مشاهدات</p><p className="font-bold text-xl">{offer.viewsCount}</p></div>
          <div><p className="text-gray-500">طلبات</p><p className="font-bold text-xl">{offer.ordersCount}</p></div>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex gap-2 flex-wrap">
        {offer.status === "ACTIVE" && (
          <button onClick={() => handleAction("pause")} disabled={actionLoading} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"><Pause className="h-4 w-4" /> إيقاف مؤقت</button>
        )}
        {(offer.status === "PAUSED" || offer.status === "DRAFT") && (
          <button onClick={() => handleAction("activate")} disabled={actionLoading} className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700 flex items-center gap-2"><Play className="h-4 w-4" /> تفعيل</button>
        )}
        {offer.status !== "CLOSED" && (
          <button onClick={() => handleAction("close")} disabled={actionLoading} className="rounded-lg border border-red-300 text-red-600 px-4 py-2 text-sm hover:bg-red-50 flex items-center gap-2"><XCircle className="h-4 w-4" /> إغلاق نهائي</button>
        )}
      </div>
    </div>
  );
}