"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Package, Store, MapPin, Minus, Plus, ShoppingCart,
  AlertCircle, CheckCircle2, BadgeCheck, Image as ImageIcon,
} from "lucide-react";

type Master = {
  id: number; name: string; slug: string; brand: string | null;
  description: string | null; images: string[]; barcode: string | null;
  qrCode: string | null; specifications: any;
  category: { id: number; name: string; slug: string };
  manufacturer: { id: number; name: string } | null;
  isVerified: boolean; status: string;
  variants: Array<{ id: number; barcode: string | null; sku: string | null; options: any }>;
  derivatives: Array<{ id: number; childMasterId: number; childName: string; childSlug: string; createdAt: string }>;
};

type Offer = {
  id: number; offerType: string; wholesalePrice: number; retailPrice: number | null;
  minOrderQty: number; maxOrderQty: number | null; unit: string;
  claimType: string; claimVerified: boolean; notes: string | null;
  supplier: { id: number; displayName: string; slug: string; isVerified: boolean; activityType: string; city: string; region: string | null };
  source: { id: number; name: string; city: string; address: string | null } | null;
  variants: Array<{ id: number; stock: number; sku: string | null; barcode: string | null; options: any; masterVariantId: number | null }>;
  totalStock: number;
};

const CLAIM_LABEL: Record<string, string> = {
  MANUFACTURER: "من المصنع مباشرة", DISTRIBUTOR: "موزع معتمد", RESELLER: "إعادة بيع",
};
const ACTIVITY_LABEL: Record<string, string> = {
  COMPANY: "شركة", WORKSHOP: "ورشة", FACTORY: "معمل", WAREHOUSE: "مخزن",
  SHOP: "محل", DISTRIBUTOR: "موزع", INDEPENDENT: "مستقل",
};

export default function MasterPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const masterId = parseInt(params.id as string);
  const preselectOfferId = searchParams.get("offer");

  const [master, setMaster] = useState<Master | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [mRes, oRes] = await Promise.all([
          fetch(`/api/products/master/${masterId}`),
          fetch(`/api/products/master/${masterId}/offers`),
        ]);
        if (mRes.status === 401) { router.push("/login?next=/wholesale/browse"); return; }
        const mData = await mRes.json();
        const oData = await oRes.json();
        if (!mData.success) { setError(mData.message); return; }
        if (!oData.success) { setError(oData.message); return; }
        setMaster(mData.master);
        setOffers(oData.offers);
        const pre = preselectOfferId ? parseInt(preselectOfferId) : null;
        const first = pre && oData.offers.find((o: Offer) => o.id === pre) ? pre : oData.offers[0]?.id || null;
        setSelectedOfferId(first);
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [masterId, preselectOfferId, router]);

  const selectedOffer = offers.find((o) => o.id === selectedOfferId);
  const selectedVariant = selectedOffer?.variants.find((v) => v.id === selectedVariantId) || null;
  const availableStock = selectedVariant ? selectedVariant.stock : selectedOffer?.totalStock || 0;

  useEffect(() => {
    setSelectedVariantId(null);
    setQty(selectedOffer?.minOrderQty || 1);
  }, [selectedOfferId, selectedOffer?.minOrderQty]);

  async function placeOrder() {
    if (!selectedOffer) return;
    setError(""); setSuccessMsg(""); setSubmitting(true);
    try {
      const res = await fetch("/api/wholesale/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ offerId: selectedOffer.id, offerVariantId: selectedVariantId, qty }] }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || "فشل إنشاء الطلب"); return; }
      setSuccessMsg(`تم إنشاء الطلب ${data.order.orderNumber}`);
      setTimeout(() => router.push("/wholesale/orders"), 1500);
    } catch { setError("خطأ في الاتصال"); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" /></div>;

  if (error && !master) return (
    <div className="min-h-screen bg-gray-50 p-4 py-12" dir="rtl">
      <div className="mx-auto max-w-md rounded-xl bg-red-50 p-6 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
        <p className="mt-3 text-sm font-bold text-red-700">{error}</p>
        <Link href="/wholesale/browse" className="mt-4 inline-block rounded-lg bg-[#ff5c00] px-4 py-2 text-sm font-bold text-white">عودة للسوق</Link>
      </div>
    </div>
  );

  if (!master) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-4 py-8" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <Link href="/wholesale/browse" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]">
          <ArrowLeft className="h-3.5 w-3.5" /> عودة للسوق
        </Link>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="aspect-square overflow-hidden rounded-2xl bg-white shadow-sm">
              {master.images[activeImage] ? (
                <img src={master.images[activeImage]} alt={master.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center"><ImageIcon className="h-16 w-16 text-gray-300" /></div>
              )}
            </div>
            {master.images.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {master.images.map((img, i) => (
                  <button key={i} onClick={() => setActiveImage(i)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${activeImage === i ? "border-[#ff5c00]" : "border-gray-200"}`}>
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="mb-1 text-xs text-gray-500">{master.category.name}</div>
            <h1 className="text-2xl font-black text-gray-900">{master.name}</h1>
            {master.brand && <div className="mt-1 text-sm text-gray-600">{master.brand}</div>}
            {master.manufacturer && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                <BadgeCheck className="h-3 w-3" /> المصنع: {master.manufacturer.name}
              </div>
            )}
            {master.description && <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{master.description}</p>}

            <div className="mt-4">
              <h2 className="mb-2 text-sm font-black text-gray-900">العروض المتاحة ({offers.length})</h2>
              {offers.length === 0 ? (
                <div className="rounded-xl bg-gray-100 p-4 text-center text-xs text-gray-500">لا توجد عروض نشطة لهذا المنتج</div>
              ) : (
                <div className="space-y-2">
                  {offers.map((o) => (
                    <button key={o.id} onClick={() => setSelectedOfferId(o.id)} className={`w-full rounded-xl border-2 p-3 text-right transition ${selectedOfferId === o.id ? "border-[#ff5c00] bg-[#fff4ed]" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Store className="h-3.5 w-3.5 text-gray-500" />
                            <span className="text-xs font-bold text-gray-900">{o.supplier.displayName}</span>
                            {o.supplier.isVerified && <BadgeCheck className="h-3.5 w-3.5 text-blue-500" />}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5">{ACTIVITY_LABEL[o.supplier.activityType]}</span>
                            {o.claimVerified && <span className="rounded bg-blue-100 px-1.5 py-0.5 font-bold text-blue-700">{CLAIM_LABEL[o.claimType]}</span>}
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{o.supplier.city}</span>
                          </div>
                          {o.source && <div className="mt-1 text-[10px] text-gray-500">المصدر: {o.source.name}</div>}
                        </div>
                        <div className="shrink-0 text-left">
                          <div className="text-base font-black text-[#ff5c00]">{o.wholesalePrice.toFixed(2)}</div>
                          <div className="text-[10px] text-gray-500">د.م / {o.unit}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-500">
                        <span>الحد الأدنى: {o.minOrderQty}</span>
                        {o.maxOrderQty && <span>· الأقصى: {o.maxOrderQty}</span>}
                        <span>· المخزون: {o.totalStock}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedOffer && (
              <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
                {selectedOffer.variants.length > 1 && (
                  <div className="mb-3">
                    <label className="mb-1 block text-xs font-bold">اختر variant</label>
                    <select value={selectedVariantId || ""} onChange={(e) => setSelectedVariantId(e.target.value ? parseInt(e.target.value) : null)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]">
                      <option value="">— اختياري —</option>
                      {selectedOffer.variants.map((v) => (
                        <option key={v.id} value={v.id} disabled={v.stock === 0}>{v.sku || `Variant #${v.id}`} (مخزون: {v.stock})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold">الكمية</label>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty((q) => Math.max(selectedOffer.minOrderQty, q - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"><Minus className="h-4 w-4" /></button>
                      <input type="number" value={qty} onChange={(e) => setQty(Math.max(selectedOffer.minOrderQty, parseInt(e.target.value) || selectedOffer.minOrderQty))} min={selectedOffer.minOrderQty} max={selectedOffer.maxOrderQty || undefined} className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm outline-none focus:border-[#ff5c00]" />
                      <button onClick={() => setQty((q) => q + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"><Plus className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] text-gray-500">المجموع</div>
                    <div className="text-xl font-black text-[#ff5c00]">{(selectedOffer.wholesalePrice * qty).toFixed(2)} د.م</div>
                  </div>
                </div>
                {qty > availableStock && <div className="mt-2 rounded bg-amber-50 p-2 text-[10px] text-amber-800">⚠️ الكمية تتجاوز المخزون المتوفر ({availableStock})</div>}
                {error && <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{error}</div>}
                {successMsg && <div className="mt-2 flex items-center gap-1 rounded bg-green-50 p-2 text-xs font-bold text-green-700"><CheckCircle2 className="h-3.5 w-3.5" />{successMsg}</div>}
                <button onClick={placeOrder} disabled={submitting || qty > availableStock} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white hover:bg-[#e64a00] disabled:opacity-50">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />} إرسال طلب الجملة
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}