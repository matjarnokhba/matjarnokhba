"use client";

import { useState, useEffect, useMemo } from "react";
import { Sparkles, Loader2, AlertCircle, ToggleLeft, ToggleRight } from "lucide-react";

type Variant = {
  id: number;
  attributes: Array<{ name: string; value: string }>;
  availableStock?: number | null;
};

type Props = {
  offerId: number;
  variants: Variant[];
  initialEnabled: boolean;
  initialBundleRulesCount: number;
  initialRequireSizeSelection?: boolean;
  readOnly?: boolean;
};

type PreviewVariant = {
  variantId: number;
  attributes: Array<{ name: string; value: string }>;
  sizeValue: string | null;
  stock: number;
  weight: number;
  isRare: boolean;
  isBlocked: boolean;
  baseQty: number;
  suggestedQty: number;
  minAllowed: number;
  maxAllowed: number;
  maxAdjust: number;
};

type PreviewData = {
  totalQty: number;
  totalDistributed: number;
  minDistributed: number;
  maxStock: number;
  variants: PreviewVariant[];
};

function fmtAttrs(attrs: Array<{ name: string; value: string }>): string {
  if (!attrs || attrs.length === 0) return "افتراضي";
  return attrs.map((a) => `${a.name}: ${a.value}`).join(" · ");
}

export default function AutoBalanceEditor({
  offerId,
  variants,
  initialEnabled,
  initialBundleRulesCount,
  initialRequireSizeSelection = false,
  readOnly,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [bundleRulesCount, setBundleRulesCount] = useState(initialBundleRulesCount);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState("");
  const [previewQty, setPreviewQty] = useState("100");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [requireSizeSelection, setRequireSizeSelection] = useState(initialRequireSizeSelection);

  const availableSizes = useMemo(() => {
    const set = new Set<string>();
    for (const v of variants) {
      for (const a of v.attributes) {
        const n = a.name.toLowerCase().trim();
        if (n.includes("مقاس") || n.includes("size")) {
          if (a.value) set.add(a.value);
        }
      }
    }
    return Array.from(set).sort();
  }, [variants]);

  useEffect(() => {
    if (!enabled) { setPreview(null); return; }
    const t = parseInt(previewQty, 10);
    if (!t || t < 1) { setPreview(null); return; }
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        // Seller preview: wildcard distribution across all variants
        const res = await fetch(
          `/api/wholesale/offers/${offerId}/auto-balance/compute?qty=${t}`
        );
        const d = await res.json();
        if (d.success) setPreview(d);
        else setPreview(null);
      } catch { setPreview(null); }
      finally { setPreviewLoading(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [enabled, previewQty, offerId, requireSizeSelection, availableSizes]);

  async function handleToggle() {
    setError("");
    if (readOnly) return;
    if (!enabled && bundleRulesCount > 0) { setShowConfirmDelete(true); return; }
    await doToggle(!enabled, false);
  }

  async function doToggle(next: boolean, deleteRules: boolean) {
    setToggling(true);
    setError("");
    try {
      const res = await fetch(`/api/wholesale/offers/${offerId}/auto-balance/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: next,
          deleteBundleRules: deleteRules,
          requireSizeSelection,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setEnabled(next);
        if (d.bundleRulesDeleted) setBundleRulesCount(0);
        setShowConfirmDelete(false);
      } else {
        setError(d.message || "فشل");
      }
    } catch { setError("خطأ في الاتصال"); }
    finally { setToggling(false); }
  }

  async function updateRequireSizeSelection(next: boolean) {
    setRequireSizeSelection(next);
    if (!enabled) return;
    try {
      await fetch(`/api/wholesale/offers/${offerId}/auto-balance/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          requireSizeSelection: next,
        }),
      });
    } catch { /* silent */ }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <Sparkles className="h-4 w-4 text-purple-500" />
            التوزيع التلقائي
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            يوزّع الكميات على الألوان المتوفرة بنسب ذكية. الألوان النادرة تُضاف يدوياً فقط.
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              enabled ? "bg-purple-600 text-white hover:bg-purple-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            } disabled:opacity-50`}
          >
            {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            {enabled ? "مفعّل" : "معطّل"}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-1 rounded-lg bg-red-50 p-2 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" /> {error}
        </div>
      )}

      {showConfirmDelete && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold text-amber-900">يوجد {bundleRulesCount} قاعدة شراء مرتبطة</p>
          <p className="mt-1 text-xs text-amber-800">تفعيل التوزيع التلقائي سيحذف جميع القواعد الحالية.</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => doToggle(true, true)} disabled={toggling} className="rounded bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50">
              {toggling ? "..." : "احذف وفعّل"}
            </button>
            <button onClick={() => setShowConfirmDelete(false)} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs hover:bg-gray-50">إلغاء</button>
          </div>
        </div>
      )}

      {enabled && !showConfirmDelete && (
        <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={requireSizeSelection}
              onChange={(e) => updateRequireSizeSelection(e.target.checked)}
              className="mt-0.5 h-4 w-4"
              disabled={readOnly || toggling}
            />
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-900">إلزام المشتري باختيار المقاس</p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                عند التفعيل: المشتري يجب أن يختار مقاساً واحداً أو أكثر قبل التوزيع.
              </p>
              {requireSizeSelection && availableSizes.length === 0 && (
                <p className="mt-1 rounded bg-amber-100 p-1 text-[10px] text-amber-800">
                  ⚠ هذا المنتج لا يحتوي على مقاسات — التفعيل لن يكون له تأثير
                </p>
              )}
              {requireSizeSelection && availableSizes.length > 0 && (
                <p className="mt-1 text-[10px] text-purple-700">
                  المقاسات المتاحة: {availableSizes.join(" · ")}
                </p>
              )}
            </div>
          </label>
        </div>
      )}

      {enabled && !showConfirmDelete && (
        <div className="space-y-3 rounded-lg border border-purple-200 bg-purple-50 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">معاينة التوزيع (كمية)</label>
            <div className="flex items-center gap-2">
              <input type="number" min="1" value={previewQty} onChange={(e) => setPreviewQty(e.target.value)} className="h-8 w-24 rounded border border-gray-200 px-2 text-xs font-bold" />
              {previewLoading && <span className="text-xs text-gray-500">يحسب...</span>}
            </div>
          </div>

          {preview && (
            <>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="rounded-full bg-purple-200 px-2 py-0.5 font-bold text-purple-800">موزّع: {preview.totalDistributed}</span>
                <span className="rounded-full bg-amber-200 px-2 py-0.5 font-bold text-amber-800">نادر كحد أقصى: {preview.minDistributed}</span>
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {preview.variants.map((v) => (
                  <div key={v.variantId} className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-xs ${v.isBlocked ? "bg-gray-100 opacity-60" : v.isRare ? "bg-amber-100" : "bg-white"}`}>
                    <span className="flex-1 truncate">
                      {fmtAttrs(v.attributes)}
                      {v.isRare && !v.isBlocked && <span className="ml-1 rounded bg-amber-400 px-1 text-[10px] font-bold text-amber-900">نادر</span>}
                    </span>
                    <span className="text-gray-500">مخزون: {v.stock}</span>
                    <span className="w-16 text-right font-bold text-gray-900">{v.suggestedQty} ق</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}