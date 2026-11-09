"use client";

import { useState } from "react";
import { Plus, Trash2, AlertCircle, Link2 } from "lucide-react";

type OfferVariant = { id: number; attributes: Array<{ name: string; value: string }> };
type BundleRule = { id: number; triggerVariantId: number; requiredVariantId: number; minQuantity: number; notes: string | null };
type Props = { offerId: number; variants: OfferVariant[]; initialRules: BundleRule[]; readOnly?: boolean };

function fmtAttrs(attrs: Array<{ name: string; value: string }>): string {
  if (!attrs || attrs.length === 0) return "افتراضي";
  return attrs.map((a) => `${a.name}: ${a.value}`).join(" · ");
}

export default function BundleRulesEditor({ offerId, variants, initialRules, readOnly }: Props) {
  const [rules, setRules] = useState<BundleRule[]>(initialRules || []);
  const [showForm, setShowForm] = useState(false);
  const [triggerId, setTriggerId] = useState<number | null>(null);
  const [requiredId, setRequiredId] = useState<number | null>(null);
  const [minQty, setMinQty] = useState("1");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState("");

  const variantLabel = (id: number): string => {
    const v = variants.find((x) => x.id === id);
    return v ? fmtAttrs(v.attributes) : `#${id}`;
  };

  async function handleAdd() {
    setError("");
    if (!triggerId || !requiredId) { setError("اختر المشغّل والمطلوب"); return; }
    if (triggerId === requiredId) { setError("لا يمكن أن يكونا نفس الخيار"); return; }
    const qty = parseInt(minQty, 10);
    if (!qty || qty < 1) { setError("الحد الأدنى 1 على الأقل"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/wholesale/offers/${offerId}/bundle-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerVariantId: triggerId, requiredVariantId: requiredId, minQuantity: qty }),
      });
      const d = await res.json();
      if (d.success) {
        setRules((prev) => [...prev, d.rule]);
        setTriggerId(null); setRequiredId(null); setMinQty("1"); setShowForm(false);
      } else setError(d.message || "فشل");
    } catch { setError("خطأ في الاتصال"); }
    finally { setSaving(false); }
  }

  async function handleDelete(ruleId: number) {
    if (!confirm("حذف هذه القاعدة؟")) return;
    setDeleting(ruleId); setError("");
    try {
      const res = await fetch(`/api/wholesale/offers/${offerId}/bundle-rules/${ruleId}`, { method: "DELETE" });
      const d = await res.json();
      if (d.success) setRules((prev) => prev.filter((r) => r.id !== ruleId));
      else setError(d.message || "فشل");
    } catch { setError("خطأ في الاتصال"); }
    finally { setDeleting(null); }
  }

  function resetForm() {
    setShowForm(false); setTriggerId(null); setRequiredId(null); setMinQty("1"); setError("");
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <Link2 className="h-4 w-4 text-gray-400" /> قواعد الحزم ({rules.length})
        </h3>
        {!readOnly && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 rounded-lg bg-[#ff5c00] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#e64a00]"
          >
            <Plus className="h-3 w-3" /> إضافة قاعدة
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-gray-500">اجعل شراء خيار معين يستلزم شراء حد أدنى من خيار آخر.</p>
      {showForm && (
        <div className="mb-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium">المشغّل</label>
              <select value={triggerId ?? ""} onChange={(e) => setTriggerId(e.target.value ? parseInt(e.target.value, 10) : null)} className="w-full rounded-lg border border-gray-200 bg-white p-1.5 text-xs">
                <option value="">اختر...</option>
                {variants.map((v) => <option key={v.id} value={v.id}>{fmtAttrs(v.attributes)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">المطلوب</label>
              <select value={requiredId ?? ""} onChange={(e) => setRequiredId(e.target.value ? parseInt(e.target.value, 10) : null)} className="w-full rounded-lg border border-gray-200 bg-white p-1.5 text-xs">
                <option value="">اختر...</option>
                {variants.map((v) => <option key={v.id} value={v.id}>{fmtAttrs(v.attributes)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">الحد الأدنى للكمية المطلوبة</label>
            <input type="number" min="1" value={minQty} onChange={(e) => setMinQty(e.target.value)} className="w-24 rounded-lg border border-gray-200 bg-white p-1.5 text-xs" />
          </div>
          {error && (
            <div className="flex items-start gap-1 rounded bg-red-50 p-1.5 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" /> {error}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="rounded-lg bg-[#ff5c00] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#e64a00] disabled:opacity-50">
              {saving ? "..." : "حفظ"}
            </button>
            <button onClick={resetForm} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-white">إلغاء</button>
          </div>
        </div>
      )}
      {rules.length === 0 ? (
        <p className="py-2 text-center text-xs text-gray-400">لا توجد قواعد</p>
      ) : (
        <div className="space-y-1.5">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 p-2 text-xs">
              <div className="flex-1">
                <span className="font-medium">{variantLabel(r.triggerVariantId)}</span>
                <span className="mx-1 text-gray-400">←</span>
                <span className="font-medium">{variantLabel(r.requiredVariantId)}</span>
                <span className="ml-1 text-gray-500">(≥{r.minQuantity})</span>
              </div>
              {!readOnly && (
                <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id} className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50" aria-label="حذف">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}