"use client";

import { useEffect, useState } from "react";
import { Loader2, X, Tag, AlertCircle, Store, CheckCircle2, Zap } from "lucide-react";

type PrepareVariant = {
  id: number;
  sku: string;
  barcode: string | null;
  price: number;
  isDefault: boolean;
  retailStock: number;
  masterVariantId: number | null;
  masterId: number | null;
};

type PrepareData = {
  needsSetup: boolean;
  product: { id: number; name: string; price: number };
  businessUnits: Array<{ id: number; name: string; type: string }>;
  variants: PrepareVariant[];
  masterId: number | null;
  hasAmbiguousMaster: boolean;
  matchedCount: number;
  unmatchableVariants: Array<string | number>;
};

type Props = {
  productId: number | null;
  onClose: () => void;
  onSuccess: (offerId: number) => void;
};

export default function OfferToWholesaleModal({ productId, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PrepareData | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reloadFlag, setReloadFlag] = useState(0);

  const [businessUnitId, setBusinessUnitId] = useState<number | null>(null);
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [minOrderQty, setMinOrderQty] = useState("1");
  const [maxOrderQty, setMaxOrderQty] = useState("");
  const [transferMap, setTransferMap] = useState<Record<number, string>>({});

  const [setupName, setSetupName] = useState("نشاط الجملة");
  const [setupType, setSetupType] = useState("WHOLESALER");
  const [setupSubmitting, setSetupSubmitting] = useState(false);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setError("");
    setData(null);
    setTransferMap({});
    (async () => {
      try {
        const res = await fetch(`/api/seller/products/${productId}/offer-to-wholesale/prepare`);
        const d = await res.json();
        if (!d.success) { setError(d.message || "فشل التحميل"); return; }
        setData(d);
        if (d.businessUnits?.length > 0) setBusinessUnitId(d.businessUnits[0].id);
        if (d.product?.price) setWholesalePrice(String(Math.round(d.product.price * 0.7)));
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [productId, reloadFlag]);

  if (!productId) return null;

  async function handleEnableWholesale() {
    if (!setupName.trim()) { setError("اسم النشاط مطلوب"); return; }
    setSetupSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/wholesale/business-units", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          name: setupName.trim(),
          type: setupType,
          capabilities: ["WHOLESALE_BUY", "WHOLESALE_SELL"],
        }),
      });
      const d = await res.json();
      const newId = d?.data?.businessUnitId ?? d?.businessUnitId ?? d?.id;
      if (newId) {
        setReloadFlag((f) => f + 1);
      } else {
        setError(d?.message || "فشل التفعيل");
      }
    } catch { setError("خطأ في الاتصال"); }
    finally { setSetupSubmitting(false); }
  }

  const canSubmit = (): boolean => {
    if (!data || !businessUnitId) return false;
    if (data.hasAmbiguousMaster) return false;
    if (data.unmatchableVariants.length > 0 && data.matchedCount === 0) return false;
    const price = Number(wholesalePrice);
    if (!price || price <= 0) return false;
    const minQ = parseInt(minOrderQty);
    if (!minQ || minQ < 1) return false;
    const transfers = Object.values(transferMap).map((q) => parseInt(q || "0")).filter((q) => q > 0);
    if (transfers.length === 0) return false;
    return true;
  };

  async function handleSubmit() {
    if (!data || !businessUnitId) return;
    const price = Number(wholesalePrice);
    const minQ = parseInt(minOrderQty);
    const maxQ = maxOrderQty ? parseInt(maxOrderQty) : null;
    if (maxQ && maxQ < minQ) { setError("الحد الأقصى يجب أن يكون ≥ الحد الأدنى"); return; }

    const transferQuantities = Object.entries(transferMap)
      .map(([vid, q]) => ({ variantId: parseInt(vid), quantity: parseInt(q || "0") }))
      .filter((t) => t.quantity > 0);

    if (transferQuantities.length === 0) { setError("حدد كمية واحدة على الأقل"); return; }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/seller/products/${productId}/offer-to-wholesale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessUnitId, wholesalePrice: price, minOrderQty: minQ, maxOrderQty: maxQ, transferQuantities }),
      });
      const d = await res.json();
      if (d.success) { onSuccess(d.offerId); }
      else { setError(d.message || "فشل الإنشاء"); }
    } catch { setError("خطأ في الاتصال"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Tag className="h-5 w-5 text-orange-500" /> عرض المنتج بالجملة
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        {loading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>}

        {!loading && data?.needsSetup && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">تفعيل البيع بالجملة</p>
                  <p className="mt-1">لنشر هذا العرض، تحتاج نشاطًا تجاريًا بصلاحية البيع بالجملة. أنشئه الآن — يستغرق ثوانٍ.</p>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">اسم النشاط</label>
              <input
                type="text"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                className="w-full rounded-lg border p-2 text-sm"
                placeholder="مثال: نشاط الجملة"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">نوع النشاط</label>
              <select
                value={setupType}
                onChange={(e) => setSetupType(e.target.value)}
                className="w-full rounded-lg border p-2 text-sm"
              >
                <option value="WHOLESALER">موزع بالجملة</option>
                <option value="IMPORTER">مستورد</option>
                <option value="DISTRIBUTOR">موزع</option>
                <option value="FACTORY">مصنع</option>
                <option value="SHOP">محل</option>
              </select>
            </div>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">إلغاء</button>
              <button
                onClick={handleEnableWholesale}
                disabled={setupSubmitting}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                {setupSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {setupSubmitting ? "جارٍ التفعيل..." : "تفعيل البيع بالجملة"}
              </button>
            </div>
          </div>
        )}

        {!loading && data && !data.needsSetup && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-gray-50 p-3">
              <div className="flex items-center gap-2 text-sm">
                <Store className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{data.product.name}</span>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                خيارات مطابقة للمنتج الأصلي: <strong>{data.matchedCount}</strong> من <strong>{data.variants.length}</strong>
              </p>
            </div>

            {data.hasAmbiguousMaster && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>الخيارات تنتمي لمنتجات أصلية مختلفة — لا يمكن إنشاء عرض واحد. تحقق من الباركودات.</div>
                </div>
              </div>
            )}

            {data.unmatchableVariants.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <p>خيارات بلا هوية أصلية مطابقة:</p>
                    <p className="mt-1 font-mono text-xs">{data.unmatchableVariants.join(", ")}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium">النشاط التجاري</label>
              <select value={businessUnitId ?? ""} onChange={(e) => setBusinessUnitId(parseInt(e.target.value))} className="w-full rounded-lg border p-2 text-sm">
                {data.businessUnits.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.type}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">سعر الجملة</label>
                <input type="number" min="0" step="0.01" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} className="w-full rounded-lg border p-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">الحد الأدنى</label>
                <input type="number" min="1" value={minOrderQty} onChange={(e) => setMinOrderQty(e.target.value)} className="w-full rounded-lg border p-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">الحد الأقصى</label>
                <input type="number" min="1" value={maxOrderQty} onChange={(e) => setMaxOrderQty(e.target.value)} placeholder="اختياري" className="w-full rounded-lg border p-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">الكميات التي ستُنقل إلى الجملة</label>
              <div className="space-y-2 max-h-64 overflow-y-auto rounded-lg border p-2">
                {data.variants.map((v) => {
                  const matched = v.masterVariantId !== null;
                  return (
                    <div key={v.id} className={`flex items-center justify-between gap-3 rounded-lg p-2 text-sm ${matched ? "bg-white" : "bg-red-50"}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{v.sku}</p>
                          {matched ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                        </div>
                        <p className="text-xs text-gray-500">متاح: {v.retailStock}</p>
                      </div>
                      <input
                        type="number" min="0" max={v.retailStock}
                        value={transferMap[v.id] ?? ""}
                        onChange={(e) => setTransferMap({ ...transferMap, [v.id]: e.target.value })}
                        placeholder="0"
                        disabled={!matched}
                        className="w-24 rounded border p-1.5 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">إلغاء</button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !canSubmit()}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm text-white hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "جارٍ الإنشاء..." : "إنشاء العرض"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}