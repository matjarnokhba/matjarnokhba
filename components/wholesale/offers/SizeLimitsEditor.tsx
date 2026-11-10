"use client";

import { useState, useMemo, useEffect } from "react";
import { Save, Loader2, AlertCircle, CheckCircle2, Ruler } from "lucide-react";

type Variant = {
  id: number;
  attributes: Array<{ name: string; value: string }>;
};

type Props = {
  offerId: number;
  variants: Variant[];
  initialLimits: Record<string, number>;
  readOnly?: boolean;
};

function getSizeFromAttrs(
  attrs: Array<{ name: string; value: string }>
): string | null {
  for (const a of attrs) {
    const n = (a.name || "").toLowerCase().trim();
    if (n.includes("مقاس") || n.includes("size")) {
      return String(a.value || "").trim() || null;
    }
  }
  return null;
}

export default function SizeLimitsEditor({
  offerId,
  variants,
  initialLimits,
  readOnly,
}: Props) {
  const availableSizes = useMemo(() => {
    const set = new Set<string>();
    for (const v of variants) {
      const s = getSizeFromAttrs(v.attributes);
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [variants]);

  const [limits, setLimits] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const s of availableSizes) {
      const v = initialLimits[s] ?? 1;
      initial[s] = v > 1 ? String(v) : "";
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dirty, setDirty] = useState(false);

  // Recompute availableSizes after mount if variants change — reset local state if not dirty
  useEffect(() => {
    if (dirty) return;
    const initial: Record<string, string> = {};
    for (const s of availableSizes) {
      const v = initialLimits[s] ?? 1;
      initial[s] = v > 1 ? String(v) : "";
    }
    setLimits(initial);
  }, [availableSizes, initialLimits, dirty]);

  if (availableSizes.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <Ruler className="h-4 w-4 text-blue-500" />
          الحد الأدنى للبيع لكل مقاس
        </h3>
        <p className="mt-2 text-xs text-gray-500">
          هذا العرض لا يحتوي على مقاسات — لا حاجة لحدود.
        </p>
      </div>
    );
  }

  function setLimit(size: string, raw: string) {
    if (raw !== "" && !/^\d+$/.test(raw)) return;
    setLimits((prev) => ({ ...prev, [size]: raw }));
    setDirty(true);
    setError("");
    setSuccess("");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const body = {
        limits: availableSizes
          .map((s) => {
            const raw = limits[s] || "1";
            const minOrderQty = parseInt(raw, 10);
            return { size: s, minOrderQty: isNaN(minOrderQty) || minOrderQty < 1 ? 1 : minOrderQty };
          })
          .filter((l) => l.minOrderQty > 1),
      };
      const res = await fetch(`/api/wholesale/offers/${offerId}/size-limits`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!d.success) {
        setError(d.message || "فشل الحفظ");
        return;
      }
      setDirty(false);
      setSuccess("تم حفظ الحدود");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <Ruler className="h-4 w-4 text-blue-500" />
          الحد الأدنى للبيع لكل مقاس
        </h3>
        {dirty && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            تغييرات غير محفوظة
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-gray-500">
        حدد الحد الأدنى الذي يجب على المشتري شراؤه من كل مقاس. اترك الحقل فارغاً = بدون حد.
      </p>

      <div className="space-y-2">
        {availableSizes.map((s) => (
          <div
            key={s}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2"
          >
            <span className="w-14 rounded bg-white px-2 py-1 text-center text-sm font-bold text-gray-900">
              {s}
            </span>
            <input
              type="number"
              min="1"
              max="10000"
              value={limits[s] || ""}
              onChange={(e) => setLimit(s, e.target.value)}
              placeholder="1 (بدون حد)"
              disabled={readOnly || saving}
              className="h-9 flex-1 rounded-lg border-2 border-gray-200 px-3 text-sm font-bold focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
            />
            <span className="w-24 text-left text-[11px] text-gray-500">
              {limits[s] && parseInt(limits[s], 10) > 1
                ? `≥ ${limits[s]} قطعة`
                : "بدون حد"}
            </span>
          </div>
        ))}
      </div>

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

      {!readOnly && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "جارٍ الحفظ..." : "حفظ الحدود"}
          </button>
        </div>
      )}
    </div>
  );
}