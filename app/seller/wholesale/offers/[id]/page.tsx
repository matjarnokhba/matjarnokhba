"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Save, AlertCircle, Package, ArrowRightLeft,
  Search, X, CheckCircle2,
} from "lucide-react";

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

type RetailVariant = {
  id: number;
  sku: string;
  barcode: string | null;
  price: number;
  productName: string;
  stock: number;
};

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

  // Transfer modal state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferFromVariant, setTransferFromVariant] = useState<number | null>(null);
  const [transferQty, setTransferQty] = useState("1");
  const [retailQuery, setRetailQuery] = useState("");
  const [retailVariants, setRetailVariants] = useState<RetailVariant[]>([]);
  const [searchingRetail, setSearchingRetail] = useState(false);
  const [transferToVariant, setTransferToVariant] = useState<number | null>(null);
  const [transferNotes, setTransferNotes] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState("");
  const [transferError, setTransferError] = useState("");

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

  async function searchRetailVariants() {
    setSearchingRetail(true);
    try {
      const url = retailQuery.trim()
        ? `/api/seller/variants/search?q=${encodeURIComponent(retailQuery.trim())}&limit=20`
        : `/api/seller/variants/search?limit=20`;
      const res = await fetch(url);
      const d = await res.json();
      if (d.success) setRetailVariants(d.variants);
    } catch {}
    setSearchingRetail(false);
  }

  function openTransferModal(variantId: number) {
    setTransferFromVariant(variantId);
    setTransferQty("1");
    setRetailQuery("");
    setTransferToVariant(null);
    setTransferNotes("");
    setTransferSuccess("");
    setTransferError("");
    setShowTransfer(true);
    searchRetailVariants();
  }

  async function doTransfer() {
    if (!transferFromVariant || !transferToVariant) {
      setTransferError("اختر variant المصدر و variant المحل");
      return;
    }
    const qty = Number(transferQty);
    if (!qty || qty <= 0) {
      setTransferError("الكمية يجب أن تكون موجبة");
      return;
    }

    const sourceVariant = offer?.variants.find((v) => v.id === transferFromVariant);
    if (!sourceVariant || sourceVariant.stock < qty) {
      setTransferError(`المخزون غير كافٍ — المتوفر: ${sourceVariant?.stock || 0}`);
      return;
    }

    setTransferring(true); setTransferError("");
    try {
      const res = await fetch(`/api/wholesale/offers/${offerId}/transfer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerVariantId: transferFromVariant,
          retailVariantId: transferToVariant,
          qty,
          notes: transferNotes.trim() || null,
        }),
      });
      const d = await res.json();
      if (!d.success) { setTransferError(d.message); return; }
      setTransferSuccess(`تم نقل ${qty} وحدة بنجاح`);
      // Update local offer state
      setOffer((prev) => prev ? {
        ...prev,
        variants: prev.variants.map((v) =>
          v.id === transferFromVariant ? { ...v, stock: v.stock - qty } : v
        ),
      } : null);
      setVariantStocks((prev) => ({ ...prev, [transferFromVariant]: (prev[transferFromVariant] || 0) - qty }));
      setTimeout(() => { setShowTransfer(false); router.refresh(); }, 1500);
    } catch { setTransferError("خطأ في الاتصال"); }
    finally { setTransferring(false); }
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

  const sourceVariant = offer.variants.find((v) => v.id === transferFromVariant);

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
                    <button type="button" onClick={() => openTransferModal(v.id)} disabled={v.stock <= 0} className="flex items-center gap-1 rounded-lg border border-[#ff5c00] bg-white px-2 py-1 text-[10px] font-bold text-[#ff5c00] hover:bg-[#fff4ed] disabled:opacity-40">
                      <ArrowRightLeft className="h-3 w-3" /> نقل
                    </button>
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

        {/* Transfer Modal */}
        {showTransfer && sourceVariant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !transferring && setShowTransfer(false)}>
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <ArrowRightLeft className="h-5 w-5 text-[#ff5c00]" />
                  نقل مخزون إلى المحل
                </h2>
                <button onClick={() => setShowTransfer(false)} disabled={transferring} className="rounded-full p-1 hover:bg-gray-100 disabled:opacity-50"><X className="h-5 w-5 text-gray-500" /></button>
              </div>

              <div className="mb-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                <strong>من:</strong> {sourceVariant.sku || `Variant #${sourceVariant.id}`} — مخزون: {sourceVariant.stock} {offer.unit}
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-xs font-bold">الكمية *</label>
                <input type="number" value={transferQty} onChange={(e) => setTransferQty(e.target.value)} min="1" max={sourceVariant.stock} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" />
                <p className="mt-1 text-[10px] text-gray-500">الحد الأقصى: {sourceVariant.stock}</p>
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-xs font-bold">إلى variant المحل *</label>
                <div className="mb-2 flex gap-2">
                  <input type="text" value={retailQuery} onChange={(e) => setRetailQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchRetailVariants())} placeholder="ابحث بالاسم، SKU، أو الباركود..." className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-[#ff5c00]" />
                  <button type="button" onClick={searchRetailVariants} disabled={searchingRetail} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50">
                    {searchingRetail ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-2">
                  {retailVariants.length === 0 ? (
                    <div className="text-center text-[11px] text-gray-500 py-4">لا توجد variants — جرّب البحث</div>
                  ) : (
                    retailVariants.map((rv) => (
                      <button
                        key={rv.id}
                        type="button"
                        onClick={() => setTransferToVariant(rv.id)}
                        className={`mb-1 flex w-full items-center justify-between rounded p-2 text-right text-xs transition ${transferToVariant === rv.id ? "bg-[#fff4ed] border border-[#ff5c00]" : "bg-white border border-gray-200 hover:bg-gray-50"}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-bold">{rv.productName}</div>
                          <div className="text-[10px] text-gray-500">{rv.sku}{rv.barcode && ` · ${rv.barcode}`} · مخزون: {rv.stock}</div>
                        </div>
                        <div className="text-[10px] font-black text-[#ff5c00]">{rv.price.toFixed(2)}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-xs font-bold">ملاحظات (اختياري)</label>
                <input type="text" value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)} maxLength={500} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-[#ff5c00]" />
              </div>

              {transferError && <div className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{transferError}</div>}
              {transferSuccess && <div className="mb-3 flex items-center gap-1 rounded-lg bg-green-50 p-2 text-xs font-bold text-green-700"><CheckCircle2 className="h-3.5 w-3.5" />{transferSuccess}</div>}

              <div className="flex gap-2">
                <button type="button" onClick={() => setShowTransfer(false)} disabled={transferring} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-bold disabled:opacity-50">إلغاء</button>
                <button type="button" onClick={doTransfer} disabled={transferring || !transferToVariant || !transferQty || Number(transferQty) <= 0} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-2 text-sm font-bold text-white hover:bg-[#e64a00] disabled:opacity-50">
                  {transferring ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />} تأكيد النقل
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}