"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Package, ShieldCheck, MapPin, Clock, CheckCircle2, Store } from "lucide-react";

type Offer = {
  id: number;
  wholesalePrice: number;
  retailPrice: number | null;
  minOrderQty: number;
  maxOrderQty: number | null;
  unit: string;
  claimType: string;
  leadTimeDays: number;
  master: { id: number; name: string; brand: string | null; images: string[]; description: string | null; category: { id: number; name: string; slug: string } };
  business: { id: number; name: string; slug: string; type: string; city: string; logo: string | null; description: string | null };
  variants: Array<{
    id: number;
    masterVariantId: number;
    stock: number;
    availableStock: number;
    masterVariant: { id: number; sku: string | null; barcode: string | null; options: any };
  }>;
  tiers: Array<{ minQty: number; maxQty: number | null; unitPrice: number }>;
};

type MyBusiness = { id: number; name: string; status: string; type: string };

export default function OfferDetailPage() {
  const params = useParams();
  const offerId = parseInt(params.id as string);

  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [myBusinesses, setMyBusinesses] = useState<MyBusiness[]>([]);
  const [selectedBizId, setSelectedBizId] = useState<number | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [qty, setQty] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState<{ orderId: number; orderNumber: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const offerRes = await fetch(`/api/marketplace/offers/${offerId}`);
        if (offerRes.status === 404) { setError("العرض غير موجود أو غير متاح"); setLoading(false); return; }
        const od = await offerRes.json();
        if (!od.success) { setError(od.message); setLoading(false); return; }
        setOffer(od.offer);
        if (od.offer.variants.length > 0) setSelectedVariantId(od.offer.variants[0].id);
        setQty(od.offer.minOrderQty);

        const meRes = await fetch("/api/auth/me");
        if (meRes.ok) {
          setAuthed(true);
          const bizRes = await fetch("/api/business");
          if (bizRes.ok) {
            const bd = await bizRes.json();
            if (bd.success) {
              const eligible = (bd.businesses || []).filter((b: MyBusiness) => b.type === "WHOLESALE_TRADER" && b.status === "VERIFIED");
              setMyBusinesses(eligible);
              if (eligible.length > 0) setSelectedBizId(eligible[0].id);
            }
          }
        } else {
          setAuthed(false);
        }
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [offerId]);

  function resolveUnitPrice(tiers: any[], basePrice: number, q: number): number {
    const applicable = tiers.filter((t) => q >= t.minQty && (t.maxQty == null || q <= t.maxQty)).sort((a, b) => b.minQty - a.minQty);
    return applicable.length > 0 ? applicable[0].unitPrice : basePrice;
  }

  const selectedVariant = offer?.variants.find(v => v.id === selectedVariantId);
  const unitPrice = offer ? resolveUnitPrice(offer.tiers, offer.wholesalePrice, qty) : 0;
  const subtotal = unitPrice * qty;
  const canSubmit = !!selectedBizId && !!selectedVariant && qty >= (offer?.minOrderQty ?? 1) && qty <= (selectedVariant?.availableStock ?? 0);

  async function handleOrder() {
    if (!canSubmit || !selectedBizId || !selectedVariant || !offer) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/business/${selectedBizId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerBusinessId: offer.business.id,
          items: [{ offerVariantId: selectedVariant.id, quantity: qty }],
          shippingCost: 0,
          discountAmount: 0,
        }),
      });
      const d = await res.json();
      if (d.success) setSuccess({ orderId: d.order.id, orderNumber: d.order.orderNumber });
      else setSubmitError(d.message);
    } catch { setSubmitError("خطأ في الاتصال"); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;
  if (error) return <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-700">{error}</div>;
  if (!offer) return null;

  if (success) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-4 py-12">
        <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
        <h1 className="text-2xl font-bold">تم إنشاء الطلب بنجاح</h1>
        <p className="text-gray-600">رقم الطلب: <span className="font-mono font-semibold">{success.orderNumber}</span></p>
        <p className="text-sm text-gray-500">سيتمكن البائع من رؤية الطلب والبدء في معالجته.</p>
        <div className="flex gap-3 justify-center">
          <Link href={`/business/${selectedBizId}`} className="rounded-lg border px-4 py-2 text-sm">نشاطي التجاري</Link>
          <Link href="/marketplace" className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm">مواصلة التسوق</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white border overflow-hidden">
          <div className="aspect-square bg-gray-100">
            {offer.master.images?.[0] ? (
              <img src={offer.master.images[0]} alt={offer.master.name} className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400"><Package className="h-24 w-24" /></div>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{offer.master.name}</h1>
            {offer.master.brand && <p className="text-gray-600">{offer.master.brand}</p>}
            <p className="text-xs text-gray-500 mt-1">{offer.master.category.name}</p>
          </div>
          <div className="rounded-lg bg-white border p-4 space-y-2">
            <p className="text-3xl font-bold text-orange-600">{offer.wholesalePrice} <span className="text-lg">د.م</span></p>
            {offer.tiers.length > 0 && (
              <div className="text-sm text-gray-600 space-y-1">
                <p className="font-medium">أسعار الجملة حسب الكمية:</p>
                {offer.tiers.map((t, i) => (
                  <p key={i}>• {t.minQty}{t.maxQty ? `-${t.maxQty}` : "+"} → <span className="font-semibold">{t.unitPrice} د.م</span></p>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-lg bg-white border p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2"><Store className="h-4 w-4 text-gray-500" /> <span className="font-medium">{offer.business.name}</span></div>
            <div className="flex items-center gap-2 text-gray-600"><MapPin className="h-4 w-4" /> {offer.business.city}</div>
            <div className="flex items-center gap-2 text-gray-600"><Clock className="h-4 w-4" /> التجهيز: {offer.leadTimeDays} أيام</div>
            <div className="flex items-center gap-2 text-green-600"><ShieldCheck className="h-4 w-4" /> هوية موثقة</div>
          </div>
        </div>
      </div>

      {offer.master.description && (
        <div className="rounded-xl bg-white border p-5">
          <h2 className="font-semibold mb-2">الوصف</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{offer.master.description}</p>
        </div>
      )}

      {authed === false && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 text-amber-800">
          <p className="font-medium mb-2">سجّل الدخول للطلب</p>
          <Link href="/login" className="text-orange-600 hover:underline text-sm">تسجيل الدخول</Link>
        </div>
      )}

      {authed === true && myBusinesses.length === 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 text-amber-800 space-y-2">
          <p className="font-medium">لا يوجد لديك نشاط جملة موثق</p>
          <p className="text-sm">لإنشاء طلبات الشراء، تحتاج حساب تاجر جملة موثق ومربوط بمتجر تجزئة.</p>
          <Link href="/business/new" className="inline-block rounded-lg bg-orange-500 text-white px-4 py-2 text-sm">إنشاء نشاط جملة</Link>
        </div>
      )}

      {authed === true && myBusinesses.length > 0 && (
        <div className="rounded-xl bg-white border p-5 space-y-4">
          <h2 className="font-semibold text-lg">إنشاء طلب</h2>

          {offer.variants.length > 1 && (
            <div>
              <label className="block text-sm font-medium mb-2">اختر المتغير</label>
              <div className="space-y-2">
                {offer.variants.map((v) => (
                  <label key={v.id} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${selectedVariantId === v.id ? "border-orange-500 bg-orange-50" : "hover:bg-gray-50"}`}>
                    <input type="radio" name="variant" checked={selectedVariantId === v.id} onChange={() => setSelectedVariantId(v.id)} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{v.masterVariant.options ? Object.values(v.masterVariant.options).join(" / ") : `المتغير #${v.id}`}</p>
                      <p className="text-xs text-gray-500">متاح: {v.availableStock}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">الكمية</label>
            <input type="number" min={offer.minOrderQty} max={selectedVariant?.availableStock ?? 0} value={qty}
              onChange={(e) => setQty(parseInt(e.target.value) || 0)} className="w-full rounded-lg border p-2" />
            <p className="text-xs text-gray-500 mt-1">الحد الأدنى: {offer.minOrderQty} · متاح: {selectedVariant?.availableStock ?? 0}</p>
          </div>

          {myBusinesses.length > 1 && (
            <div>
              <label className="block text-sm font-medium mb-2">الشراء باسم</label>
              <select value={selectedBizId ?? ""} onChange={(e) => setSelectedBizId(parseInt(e.target.value))} className="w-full rounded-lg border p-2">
                {myBusinesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          <div className="rounded-lg bg-gray-50 p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span>سعر الوحدة:</span> <span className="font-semibold">{unitPrice} د.م</span></div>
            <div className="flex justify-between"><span>الكمية:</span> <span>{qty}</span></div>
            <div className="flex justify-between border-t pt-2 text-base"><span className="font-semibold">المجموع:</span> <span className="font-bold text-orange-600">{subtotal} د.م</span></div>
          </div>

          {submitError && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{submitError}</div>}

          <button onClick={handleOrder} disabled={!canSubmit || submitting}
            className="w-full rounded-lg bg-orange-500 text-white py-3 font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {submitting ? "جارٍ الإنشاء..." : "إنشاء الطلب"}
          </button>
        </div>
      )}
    </div>
  );
}