"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Save, AlertCircle, Package } from "lucide-react";

type OfferDetail = {
  id: number;
  master: { id: number; name: string; slug: string };
  wholesalePrice: number; retailPrice: number | null;
  minOrderQty: number; maxOrderQty: number | null; unit: string;
  claimType: string; claimVerified: boolean; claimProofUrl: string | null;
  claimNotes: string | null; isActive: boolean; notes: string | null;
  sourceId: number | null;
  variants: Array<{ id: number; masterVariantId: number | null; stock: number; sku: string | null; barcode: string | null; options: any }>;
  orderItemsCount: number;
};

type Source = { id: number; name: string; city: string };

export default function EditOfferPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = parseInt(params.id as string);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sources, setSources] = useState<Source[]>([]);

  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [minOrderQty, setMinOrderQty] = useState("");
  const [maxOrderQty, setMaxOrderQty] = useState("");
  const [unit, setUnit] = useState("PIECE");
  const [sourceId, setSourceId] = useState("");
  const [notes, setNotes] = useState("");
  const [claimProofUrl, setClaimProofUrl] = useState("");
  const [claimNotes, setClaimNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [variantStocks, setVariantStocks] = useState<Record<number, number>>({});

  useEffect(() => {
    (async () => {
      try {
        const [oRes, sRes] = await Promise.all([
          fetch(`/api/wholesale/offers/${offerId}`),
          fetch("/api/wholesale/sources"),
        ]);
        if (oRes.status === 401) { router.push("/login"); return; }
        const oData = await oRes.json();
        const sData = await sRes.json();
        if (!oData.success) { setError(oData.message); return; }
        const o: OfferDetail = oData.offer;
        setOffer(o);
        setWholesalePrice(o.wholesalePrice.toString());
        setRetailPrice(o.retailPrice ? o.retailPrice.toString() : "");
        setMinOrderQty(o.minOrderQty.toString());
        setMaxOrderQty(o.maxOrderQty ? o.maxOrderQty.toString() : "");
        setUnit(o.unit);
        setSourceId(o.sourceId ? o.sourceId.toString() : "");
        setNotes(o.notes || "");
        setClaimProofUrl(o.claimProofUrl || "");
        setClaimNotes(o.claimNotes || "");
        setIsActive(o.isActive);
        const stocks: Record<number, number> = {};
        o.variants.forEach((v) => { stocks[v.id] = v.stock; });
        setVariantStocks(stocks);
        if (sData.success) setSources(sData.sources);
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [offerId, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      const variants = Object.entries(variantStocks).map(([id, stock]) => ({
        id: parseInt(id), stock,
      }));
      const res = await fetch(`/api/wholesale/offers/${offerId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wholesalePrice: Number(wholesalePrice),
          retailPrice: retailPrice ? Number(retailPrice) : null,
          minOrderQty: Number(minOrderQty),
          maxOrderQty: maxOrderQty ? Number(maxOrderQty) : null,
          unit, sourceId: sourceId ? parseInt(sourceId) : null,
          notes: notes.trim() || null,
          claimProofUrl: claimProofUrl.trim() || null,
          claimNotes: claimNotes.trim() || null,
          isActive, variants,
        }),
      });
      const d = await res.json();
      if (!d.success) { setError(d.message); return; }
      router.push("/seller/wholesale/offers");
      router.refresh();
    } catch { setError("خطأ في الاتصال"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" /></div>;
  if (error && !offer) return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mx-auto max-w-md rounded-xl bg-red-50 p-6 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
        <p className="mt-3 text-sm font-bold text-red-700">{error}</p>
        <Link href="/seller/wholesale/offers" className="mt-4 inline-block rounded-lg bg-[#ff5c00] px-4 py-2 text-sm font-bold text-white">عودة</Link>
      </div>
    </div>
  );
  if (!offer) return null;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mx-auto max-w-2xl">
        <Link href="/seller/wholesale/offers" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]">
          <ArrowLeft className="h-3.5 w-3.5" /> عودة للعروض
        </Link>
        <div className="mb-6 flex items-center gap-3">
          <Package className="h-8 w-8 text-[#ff5c00]" />
          <div>
            <h1 className="text-xl font-black">تعديل العرض</h1>
            <p className="text-xs text-gray-500">{offer.master.name}</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl bg-white p-5 shadow-sm space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="mb-1 block text-xs font-bold">السعر *</label><input type="number" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} min="0.01" step="0.01" required className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" /></div>
              <div><label className="mb-1 block text-xs font-bold">سعر التجزئة</label><input type="number" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} min="0.01" step="0.01" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" /></div>
              <div><label className="mb-1 block text-xs font-bold">الحد الأدنى *</label><input type="number" value={minOrderQty} onChange={(e) => setMinOrderQty(e.target.value)} min="1" required className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" /></div>
              <div><label className="mb-1 block text-xs font-bold">الحد الأقصى</label><input type="number" value={maxOrderQty} onChange={(e) => setMaxOrderQty(e.target.value)} min="1" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" /></div>
              <div><label className="mb-1 block text-xs font-bold">الوحدة</label><select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]"><option value="PIECE">قطعة</option><option value="PAIR">زوج</option><option value="SET">مجموعة</option><option value="PACK">عبوة</option><option value="BOX">صندوق</option><option value="KG">كيلوغرام</option><option value="GRAM">غرام</option><option value="LITER">لتر</option><option value="ML">مليلتر</option></select></div>
              <div><label className="mb-1 block text-xs font-bold">المصدر</label><select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]"><option value="">— بدون —</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4" />
              <span className="text-xs font-bold">العرض نشط</span>
            </label>
            <div><label className="mb-1 block text-xs font-bold">ملاحظات</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]" /></div>
          </div>

          {offer.variants.length > 0 && (
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-black">المخزون لكل variant</h2>
              <div className="space-y-2">
                {offer.variants.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 rounded-lg bg-gray-50 p-2">
                    <div className="flex-1 text-xs">{v.sku || `Variant #${v.id}`}{v.barcode && ` · ${v.barcode}`}</div>
                    <input type="number" value={variantStocks[v.id] || 0} onChange={(e) => setVariantStocks({ ...variantStocks, [v.id]: parseInt(e.target.value) || 0 })} min="0" className="w-20 rounded border border-gray-200 px-2 py-1 text-xs" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}

          <div className="flex gap-2">
            <Link href="/seller/wholesale/offers" className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-bold">إلغاء</Link>
            <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white hover:bg-[#e64a00] disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}