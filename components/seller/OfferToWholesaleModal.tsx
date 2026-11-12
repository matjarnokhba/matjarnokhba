"use client";

import { useEffect, useState } from "react";
import {
  Loader2, X, Tag, AlertCircle, Store, CheckCircle2, Zap,
  Layers, Split, Boxes, Package, Info,
} from "lucide-react";

type DisplayAttribute = { name: string; value: string; order: number };

type PrepareVariant = {
  id: number;
  sku: string;
  barcode: string | null;
  price: number;
  isDefault: boolean;
  retailStock: number;
  displayAttributes: DisplayAttribute[];
  masterVariantId: number | null;
  masterId: number | null;
};

function formatAttributes(attrs: DisplayAttribute[] | undefined): string {
  if (!attrs || attrs.length === 0) return "";
  return attrs.map((a) => `${a.name}: ${a.value}`).join(" · ");
}

type PrepareData = {
  needsSetup: boolean;
  product: { id: number; name: string; price: number; totalStock?: number };
  businessUnits: Array<{ id: number; name: string; type: string }>;
  variants: PrepareVariant[];
  masterId: number | null;
  hasAmbiguousMaster: boolean;
  matchedCount: number;
  unmatchableVariants: Array<string | number>;
  existingOfferId?: number | null;
  existingPoolMode?: string | null;
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

  const [inventoryMode, setInventoryMode] = useState<"SHARED" | "SPLIT">("SHARED");
  const [splitMap, setSplitMap] = useState<Record<number, string>>({});

  const [setupName, setSetupName] = useState("نشاط الجملة");
  const [setupType, setSetupType] = useState("WHOLESALER");
  const [setupSubmitting, setSetupSubmitting] = useState(false);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setError("");
    setData(null);
    setSplitMap({});
    (async () => {
      try {
        const res = await fetch(`/api/seller/products/${productId}/offer-to-wholesale/prepare`);
        const d = await res.json();
        if (!d.success) { setError(d.message || "فشل التحميل"); return; }
        setData(d);
        if (d.businessUnits?.length > 0) setBusinessUnitId(d.businessUnits[0].id);
        if (d.product?.price) setWholesalePrice(String(Math.round(d.product.price * 0.7)));
        
        // Set initial inventory mode from existing pool
        const initialMode: "SHARED" | "SPLIT" = d.existingPoolMode === "SPLIT" ? "SPLIT" : "SHARED";
        setInventoryMode(initialMode);
        
        // Init splitMap (retailQty per variant)
        const map: Record<number, string> = {};
        for (const v of d.variants as PrepareVariant[]) {
          if (v.masterVariantId !== null && v.retailStock > 0) {
            map[v.id] = String(Math.floor(v.retailStock / 2));
          }
        }
        setSplitMap(map);
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
      const listRes = await fetch("/api/wholesale/business-units");
      const listData = await listRes.json();
      const existingBUs = listData?.items ?? listData?.businessUnits ?? [];
      const upgradeable = existingBUs.find((bu: any) => {
        const caps = Array.isArray(bu.capabilities) ? bu.capabilities : [];
        return caps.includes("RETAIL") && !caps.includes("WHOLESALE_SELL") && bu.status === "ACTIVE";
      });

      if (upgradeable) {
        const patchRes = await fetch(`/api/wholesale/business-units/${upgradeable.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capabilities: [...new Set([...(upgradeable.capabilities || []), "WHOLESALE_BUY", "WHOLESALE_SELL"])],
          }),
        });
        const patchData = await patchRes.json();
        if (patchRes.ok && patchData.success !== false) {
          setReloadFlag((f) => f + 1);
          return;
        }
      }

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

  function setSplitForVariant(variantId: number, raw: string) {
    if (raw !== "" && !/^\d+$/.test(raw)) return;
    setSplitMap((prev) => ({ ...prev, [variantId]: raw }));
  }

  const matchedVariants = data ? data.variants.filter((v) => v.masterVariantId !== null) : [];
  const totalStock = data?.product.totalStock ?? matchedVariants.reduce((s, v) => s + v.retailStock, 0);

  // SHARED: everything goes to wholesale
  // SPLIT: user sets retail; rest goes to wholesale
  const wholesaleTotal = (() => {
    if (!data) return 0;
    if (inventoryMode === "SHARED") return totalStock;
    let wholesale = 0;
    for (const v of matchedVariants) {
      const raw = splitMap[v.id] || "0";
      const retail = Math.max(0, Math.min(v.retailStock, parseInt(raw, 10) || 0));
      wholesale += v.retailStock - retail;
    }
    return wholesale;
  })();

  const retailTotal = inventoryMode === "SHARED" ? totalStock : totalStock - wholesaleTotal;

  const canSubmit = (): boolean => {
    if (!data || !businessUnitId) return false;
    if (data.hasAmbiguousMaster) return false;
    if (data.unmatchableVariants.length > 0 && data.matchedCount === 0) return false;
    const price = Number(wholesalePrice);
    if (!price || price <= 0) return false;
    const minQ = parseInt(minOrderQty);
    if (!minQ || minQ < 1) return false;
    if (wholesaleTotal <= 0) return false;
    return true;
  };

  async function handleSubmit() {
    if (!data || !businessUnitId) return;
    const price = Number(wholesalePrice);
    const minQ = parseInt(minOrderQty);
    const maxQ = maxOrderQty ? parseInt(maxOrderQty) : null;
    if (maxQ && maxQ < minQ) { setError("الحد الأقصى يجب أن يكون ≥ الحد الأدنى"); return; }

    if (wholesaleTotal <= 0) {
      setError("لا يوجد مخزون كافٍ للجملة");
      return;
    }

    setSubmitting(true);
    setError("");

    const payload: Record<string, unknown> = {
      businessUnitId,
      wholesalePrice: price,
      minOrderQty: minQ,
      maxOrderQty: maxQ,
      inventoryMode,
    };

    if (inventoryMode === "SPLIT") {
      const variantSplits = matchedVariants.map((v) => {
        const raw = splitMap[v.id] || "0";
        const retail = Math.max(0, Math.min(v.retailStock, parseInt(raw, 10) || 0));
        return { variantId: v.id, retailQty: retail };
      });
      payload.variantSplits = variantSplits;
    }

    try {
      const res = await fetch(`/api/seller/products/${productId}/offer-to-wholesale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (d.success) { onSuccess(d.offerId); }
      else { setError(d.message || "فشل الإنشاء"); }
    } catch { setError("خطأ في الاتصال"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} dir="rtl">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Tag className="h-5 w-5 text-orange-500" /> عرض المنتج بالجملة
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        {loading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>}

        {/* === needsSetup flow (unchanged) === */}
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
              <input type="text" value={setupName} onChange={(e) => setSetupName(e.target.value)} className="w-full rounded-lg border p-2 text-sm" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">نوع النشاط</label>
              <select value={setupType} onChange={(e) => setSetupType(e.target.value)} className="w-full rounded-lg border p-2 text-sm">
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
              <button onClick={handleEnableWholesale} disabled={setupSubmitting} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                {setupSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {setupSubmitting ? "جارٍ التفعيل..." : "تفعيل البيع بالجملة"}
              </button>
            </div>
          </div>
        )}

        {/* === Main form === */}
        {!loading && data && !data.needsSetup && (
          <div className="space-y-4">
            {/* Product card */}
            <div className="rounded-lg border bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-500" />
                  <span className="font-semibold text-sm">{data.product.name}</span>
                </div>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                  {totalStock} قطعة
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600">
                خيارات مطابقة: <strong>{data.matchedCount}</strong> من <strong>{data.variants.length}</strong>
              </p>
            </div>

            {/* Existing offer warning */}
            {data.existingOfferId && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                <div className="flex items-start gap-1">
                  <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  <span>
                    يوجد عرض سابق (#{data.existingOfferId}). سيتم تحديثه وليس إنشاء عرض مكرر.
                  </span>
                </div>
              </div>
            )}

            {data.hasAmbiguousMaster && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>الخيارات تنتمي لمنتجات أصلية مختلفة — لا يمكن إنشاء عرض واحد. تحقق من الباركودات.</div>
                </div>
              </div>
            )}

            {data.unmatchableVariants.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                <div className="flex items-start gap-1">
                  <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  <div>
                    <p>خيارات بلا هوية أصلية مطابقة — لن تُضاف للعرض:</p>
                    <p className="mt-1 font-mono text-[10px]">{data.unmatchableVariants.join(", ")}</p>
                  </div>
                </div>
              </div>
            )}

            {/* BU + Pricing */}
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

            {/* Inventory Mode */}
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-900">طريقة المخزون</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setInventoryMode("SHARED")}
                  className={`rounded-lg border-2 p-3 text-right transition ${
                    inventoryMode === "SHARED" ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-300"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Layers className={`h-5 w-5 flex-shrink-0 ${inventoryMode === "SHARED" ? "text-indigo-600" : "text-gray-400"}`} />
                    <div className="flex-1">
                      <p className="text-sm font-bold">مخزون موحد</p>
                      <p className="mt-0.5 text-[11px] text-gray-600">
                        كل المخزون يُدمج في رصيد واحد مشترك بين متجرك والجملة
                      </p>
                    </div>
                    {inventoryMode === "SHARED" && <CheckCircle2 className="h-5 w-5 text-indigo-600 flex-shrink-0" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInventoryMode("SPLIT")}
                  className={`rounded-lg border-2 p-3 text-right transition ${
                    inventoryMode === "SPLIT" ? "border-amber-500 bg-amber-50" : "border-gray-200 hover:border-amber-300"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Split className={`h-5 w-5 flex-shrink-0 ${inventoryMode === "SPLIT" ? "text-amber-600" : "text-gray-400"}`} />
                    <div className="flex-1">
                      <p className="text-sm font-bold">مخزون منفصل</p>
                      <p className="mt-0.5 text-[11px] text-gray-600">
                        تحدد لكل خيار كم يبقى في التجزئة، والباقي للجملة
                      </p>
                    </div>
                    {inventoryMode === "SPLIT" && <CheckCircle2 className="h-5 w-5 text-amber-600 flex-shrink-0" />}
                  </div>
                </button>
              </div>
            </div>

            {/* SHARED — summary */}
            {inventoryMode === "SHARED" && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm">
                <p className="font-bold text-indigo-900">سيتم دمج كل المخزون</p>
                <p className="mt-1 text-xs text-indigo-800">
                  {totalStock} قطعة تصبح مخزونًا واحدًا مشتركًا. البيع من التجزئة أو الجملة ينقص الرصيد نفسه.
                </p>
              </div>
            )}

            {/* SPLIT — per-variant inputs */}
            {inventoryMode === "SPLIT" && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-xs font-bold text-gray-900">لكل خيار: كم يبقى في التجزئة؟</p>
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                  {matchedVariants.map((v) => {
                    const raw = splitMap[v.id] || "0";
                    const retail = Math.max(0, Math.min(v.retailStock, parseInt(raw, 10) || 0));
                    const wholesale = v.retailStock - retail;
                    const overLimit = (parseInt(raw, 10) || 0) > v.retailStock;
                    return (
                      <div key={v.id} className="rounded border border-gray-100 bg-gray-50 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-medium truncate">
                            {formatAttributes(v.displayAttributes) || v.sku}
                          </p>
                          <span className="text-[10px] text-gray-500 flex-shrink-0">إجمالي: {v.retailStock}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="flex-1">
                            <label className="block text-[10px] text-gray-500">تجزئة</label>
                            <input
                              type="number"
                              min="0"
                              max={v.retailStock}
                              value={raw}
                              onChange={(e) => setSplitForVariant(v.id, e.target.value)}
                              className={`h-8 w-full rounded border px-2 text-xs font-bold focus:outline-none ${
                                overLimit ? "border-amber-400 bg-amber-50" : "border-gray-200"
                              }`}
                            />
                          </div>
                          <div className="w-20 text-center">
                            <div className="text-[10px] text-gray-500">جملة</div>
                            <div className="text-sm font-bold text-amber-700">{wholesale}</div>
                          </div>
                        </div>
                        {overLimit && (
                          <p className="mt-1 text-[10px] text-amber-700">⚠ يتجاوز المتاح ({v.retailStock}). سيُقص.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between rounded bg-amber-50 p-2 text-[11px]">
                  <span>تجزئة: <strong>{retailTotal}</strong></span>
                  <span>جملة: <strong>{wholesaleTotal}</strong></span>
                  <span className="text-gray-500">إجمالي: <strong>{totalStock}</strong></span>
                </div>
              </div>
            )}

            {/* Total to wholesale preview */}
            <div className="rounded-lg bg-emerald-50 p-2 text-sm">
              <div className="flex justify-between">
                <span className="text-emerald-800">سيُضاف للجملة:</span>
                <span className="font-bold text-emerald-900">{wholesaleTotal} قطعة</span>
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