"use client";

import { useState, useEffect } from "react";
import {
  Layers,
  Split,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Store,
  Building2,
} from "lucide-react";

type Props = {
  offerId: number;
  readOnly?: boolean;
};

type VariantRow = {
  masterVariantId: number;
  sku: string | null;
  barcode: string | null;
  attributes: Array<{ name: string; value: string }>;
  wholesaleQty: number;
  reservedQty: number;
  retailQty: number;
};

type State = {
  mode: "SHARED" | "SPLIT";
  poolId: number;
  variants: VariantRow[];
  totalWholesale: number;
  totalRetail: number;
  linkedProducts: Array<{ id: number; name: string; poolId: number | null }>;
  hasRetailProduct: boolean;
};

function fmtAttrs(attrs: Array<{ name: string; value: string }>): string {
  if (!attrs || attrs.length === 0) return "افتراضي";
  return attrs.map((a) => `${a.name}: ${a.value}`).join(" · ");
}

export default function InventoryModeEditor({ offerId, readOnly }: Props) {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitQty, setSplitQty] = useState("");

  useEffect(() => {
    load();
  }, [offerId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/wholesale/offers/${offerId}/inventory-mode`);
      const d = await res.json();
      if (d.success) setState(d);
      else setError(d.message || "فشل التحميل");
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }

  async function applyMode(mode: "SHARED" | "SPLIT", retailSplit?: number) {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/wholesale/offers/${offerId}/inventory-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, retailSplit }),
      });
      const d = await res.json();
      if (!d.success) {
        setError(d.message || "فشل التبديل");
        return;
      }
      setSuccess(mode === "SHARED" ? "تم تفعيل المخزون الموحد" : "تم فصل المخزون");
      setShowSplitDialog(false);
      await load();
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSharedClick() {
    if (!state || readOnly) return;
    if (!state.hasRetailProduct) {
      setError("لا يوجد منتج تجزئة مرتبط. أضف المنتج إلى متجرك أولاً.");
      return;
    }
    applyMode("SHARED");
  }

  function handleSplitClick() {
    if (!state || readOnly) return;
    setSplitQty(String(Math.floor(state.totalWholesale / 2)));
    setShowSplitDialog(true);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-xs text-gray-500">{error || "لا يمكن تحميل بيانات المخزون"}</p>
      </div>
    );
  }

  // M12.6: realTotal per mode (SHARED: retail=pool=same stock)
  const realTotal = state.mode === "SHARED"
    ? state.totalRetail
    : state.totalRetail + state.totalWholesale;
  const totalForSplit = realTotal;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
        <Layers className="h-4 w-4 text-indigo-500" />
        طريقة المخزون
      </h3>
      <p className="mb-3 text-xs text-gray-500">
        اختر كيف يدير النظام مخزون هذا المنتج بين الجملة والتجزئة.
      </p>

      <div className="space-y-2">
        {/* SHARED */}
        <button
          type="button"
          onClick={handleSharedClick}
          disabled={readOnly || submitting}
          className={`w-full rounded-lg border-2 p-3 text-right transition disabled:opacity-50 ${
            state.mode === "SHARED"
              ? "border-indigo-500 bg-indigo-50"
              : "border-gray-200 hover:border-indigo-300"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="flex items-center gap-1 text-sm font-bold text-gray-900">
                <Store className="h-3.5 w-3.5" /> مخزون موحد
              </p>
              <p className="mt-0.5 text-[11px] text-gray-600">
                المخزون مشترك بين متجرك والجملة — أي بيع ينقص من نفس الرصيد
              </p>
              {state.mode === "SHARED" ? (
                <div className="mt-1 space-y-1">
                  <div className="rounded bg-indigo-100 px-2 py-1 text-[11px] font-bold text-indigo-800">
                    {state.mode === "SHARED"
                      ? `المخزون الحقيقي: ${realTotal} قطعة`
                      : `عند التفعيل: ${realTotal} قطعة`}
                  </div>
                  <p className="text-[10px] text-gray-500">
                    {state.mode === "SHARED"
                      ? "رقم واحد — يظهر في: متجر التجزئة · المحل · الجملة"
                      : `(سيُدمج تجزئة ${state.totalRetail} + جملة ${state.totalWholesale})`}
                  </p>
                  <p className="text-[10px] text-indigo-600">
                    ✓ أي بيع من أي قناة ينقص هذا الرقم
                  </p>
                </div>
              ) : (
                <div className="mt-1 space-y-1">
                  <div className="rounded bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800">
                    الإجمالي: {realTotal} قطعة
                  </div>
                  <p className="text-[10px] text-gray-500">
                    تجزئة {state.totalRetail} + جملة {state.totalWholesale}
                  </p>
                  <p className="text-[10px] text-amber-600">
                    ✓ مخزونان منفصلان — البيع من أحدهما لا يؤثر على الآخر
                  </p>
                </div>
              )}
            </div>
            {state.mode === "SHARED" && (
              <CheckCircle2 className="h-5 w-5 text-indigo-600" />
            )}
          </div>
        </button>

        {/* SPLIT */}
        <button
          type="button"
          onClick={handleSplitClick}
          disabled={readOnly || submitting}
          className={`w-full rounded-lg border-2 p-3 text-right transition disabled:opacity-50 ${
            state.mode === "SPLIT"
              ? "border-amber-500 bg-amber-50"
              : "border-gray-200 hover:border-amber-300"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="flex items-center gap-1 text-sm font-bold text-gray-900">
                <Split className="h-3.5 w-3.5" /> مخزون منفصل
              </p>
              <p className="mt-0.5 text-[11px] text-gray-600">
                كمية مستقلة للتجزئة وكمية مستقلة للجملة — لا تؤثر إحداهما في الأخرى
              </p>
              <div className="mt-1 flex gap-2 text-[10px] text-gray-500">
                <span>تجزئة: {state.totalRetail}</span>
                <span>·</span>
                <span>جملة: {state.totalWholesale}</span>
                <span>·</span>
                <span className="font-bold text-amber-700">إجمالي: {state.totalRetail + state.totalWholesale}</span>
              </div>
            </div>
            {state.mode === "SPLIT" && (
              <CheckCircle2 className="h-5 w-5 text-amber-600" />
            )}
          </div>
        </button>
      </div>

      {state.variants.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] text-gray-500 hover:text-gray-700">
            تفاصيل الكميات لكل خيار ({state.variants.length})
          </summary>
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded border border-gray-100 bg-gray-50 p-2 text-[11px]">
            {state.variants.map((v) => (
              <div key={v.masterVariantId} className="flex justify-between gap-2">
                <span className="flex-1 truncate text-gray-700">{fmtAttrs(v.attributes)}</span>
                {state.mode === "SHARED" ? (
                  <span className="font-bold text-indigo-700">{Math.max(v.retailQty, v.wholesaleQty)}</span>
                ) : (
                  <>
                    <span className="text-gray-500">تجزئة: {v.retailQty}</span>
                    <span className="text-gray-500">جملة: {v.wholesaleQty}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-1 rounded-lg bg-red-50 p-2 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="mt-3 flex items-center gap-1 rounded-lg bg-green-50 p-2 text-xs text-green-700">
          <CheckCircle2 className="h-3 w-3" /> {success}
        </div>
      )}

      {/* Split dialog */}
      {showSplitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowSplitDialog(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-gray-900">
              <Split className="h-5 w-5 text-amber-600" />
              فصل المخزون
            </h3>
            {state.mode === "SHARED" ? (
              <p className="mb-3 text-sm text-gray-700">
                المخزون الحقيقي: <strong>{realTotal}</strong> قطعة (رقم واحد في كل القنوات).
                عند الفصل، حدد كم يبقى للتجزئة، والباقي يذهب للجملة.
              </p>
            ) : (
              <p className="mb-3 text-sm text-gray-700">
                الحالي: تجزئة {state.totalRetail} + جملة {state.totalWholesale} = <strong>{realTotal}</strong>.
                حدد كم يبقى للتجزئة.
              </p>
            )}
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                للتجزئة
              </label>
              <input
                type="number"
                min="0"
                max={totalForSplit}
                value={splitQty}
                onChange={(e) => setSplitQty(e.target.value)}
                className="h-10 w-full rounded-lg border-2 border-gray-200 px-3 text-sm font-bold focus:border-amber-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                يبقى للجملة: {Math.max(0, totalForSplit - (parseInt(splitQty, 10) || 0))}
              </p>
              {(parseInt(splitQty, 10) || 0) > totalForSplit && (
                <p className="mt-1 rounded bg-amber-50 p-1 text-[11px] text-amber-700">
                  ⚠ الرقم أكبر من المتاح ({totalForSplit}). سيُقص إلى {totalForSplit}.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSplitDialog(false)}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => applyMode("SPLIT", parseInt(splitQty, 10) || 0)}
                disabled={submitting}
                className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {submitting ? "..." : "تأكيد"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}