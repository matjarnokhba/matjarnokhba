"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, AlertCircle, Link2, ChevronDown, ChevronUp, Ratio } from "lucide-react";

type OfferVariant = { id: number; attributes: Array<{ name: string; value: string }> };
type BundleRule = {
  id: number;
  triggerVariantId: number;
  requiredVariantId: number;
  minQuantity: number;
  isMultiplied: boolean;
  notes: string | null;
};

type Props = {
  offerId: number;
  variants: OfferVariant[];
  initialRules: BundleRule[];
  readOnly?: boolean;
};

function fmtAttrs(attrs: Array<{ name: string; value: string }>): string {
  if (!attrs || attrs.length === 0) return "افتراضي";
  return attrs.map((a) => `${a.name}: ${a.value}`).join(" · ");
}

type GroupedRules = {
  triggerVariantId: number;
  triggerLabel: string;
  rules: BundleRule[];
};

export default function BundleRulesEditor({ offerId, variants, initialRules, readOnly }: Props) {
  const [rules, setRules] = useState<BundleRule[]>(initialRules || []);
  const [showForm, setShowForm] = useState(false);
  const [presetTriggerId, setPresetTriggerId] = useState<number | null>(null);
  const [triggerId, setTriggerId] = useState<number | null>(null);
  const [requiredId, setRequiredId] = useState<number | null>(null);
  const [minQty, setMinQty] = useState("1");
  const [isMultiplied, setIsMultiplied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

  const variantLabel = (id: number): string => {
    const v = variants.find((x) => x.id === id);
    return v ? fmtAttrs(v.attributes) : `#${id}`;
  };

  // Group rules by trigger
  const groups: GroupedRules[] = useMemo(() => {
    const map = new Map<number, GroupedRules>();
    for (const rule of rules) {
      const existing = map.get(rule.triggerVariantId);
      if (existing) {
        existing.rules.push(rule);
      } else {
        map.set(rule.triggerVariantId, {
          triggerVariantId: rule.triggerVariantId,
          triggerLabel: variantLabel(rule.triggerVariantId),
          rules: [rule],
        });
      }
    }
    return Array.from(map.values());
  }, [rules, variants]);

  // Variants that can be triggers (any variant)
  // Variants that can be required (any variant that's not already in this trigger's group)
  const availableRequiredForTrigger = useMemo(() => {
    if (!triggerId) return variants;
    const existing = rules
      .filter((r) => r.triggerVariantId === triggerId)
      .map((r) => r.requiredVariantId);
    return variants.filter((v) => v.id !== triggerId && !existing.includes(v.id));
  }, [triggerId, rules, variants]);

  function resetForm() {
    setShowForm(false);
    setPresetTriggerId(null);
    setTriggerId(null);
    setRequiredId(null);
    setMinQty("1");
    setIsMultiplied(false);
    setError("");
  }

  function openFormWithTrigger(triggerVariantId: number) {
    setShowForm(true);
    setPresetTriggerId(triggerVariantId);
    setTriggerId(triggerVariantId);
    setRequiredId(null);
    setMinQty("1");
    setIsMultiplied(false);
    setError("");
  }

  function openFormNew() {
    setShowForm(true);
    setPresetTriggerId(null);
    setTriggerId(null);
    setRequiredId(null);
    setMinQty("1");
    setIsMultiplied(false);
    setError("");
  }

  async function handleAdd() {
    setError("");
    if (!triggerId) { setError("اختر اللون المشغّل"); return; }
    if (!requiredId) { setError("اختر اللون المطلوب"); return; }
    if (triggerId === requiredId) { setError("لا يمكن أن يكونا نفس الخيار"); return; }
    const qty = parseInt(minQty, 10);
    if (!qty || qty < 1) { setError("الحد الأدنى 1 على الأقل"); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/wholesale/offers/${offerId}/bundle-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerVariantId: triggerId,
          requiredVariantId: requiredId,
          minQuantity: qty,
          isMultiplied,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setRules((prev) => [...prev, d.rule]);
        // Keep form open if user is adding to existing group
        if (presetTriggerId) {
          setRequiredId(null);
          setMinQty("1");
          setIsMultiplied(false);
        } else {
          resetForm();
        }
      } else {
        setError(d.message || "فشل الحفظ");
      }
    } catch { setError("خطأ في الاتصال"); }
    finally { setSaving(false); }
  }

  async function handleDelete(ruleId: number) {
    if (!confirm("حذف هذه القاعدة؟")) return;
    setDeleting(ruleId);
    setError("");
    try {
      const res = await fetch(`/api/wholesale/offers/${offerId}/bundle-rules/${ruleId}`, { method: "DELETE" });
      const d = await res.json();
      if (d.success) setRules((prev) => prev.filter((r) => r.id !== ruleId));
      else setError(d.message || "فشل");
    } catch { setError("خطأ في الاتصال"); }
    finally { setDeleting(null); }
  }

  function toggleGroup(triggerVariantId: number) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(triggerVariantId)) next.delete(triggerVariantId);
      else next.add(triggerVariantId);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <Link2 className="h-4 w-4 text-gray-400" />
          شروط الشراء المرتبطة ({rules.length})
        </h3>
        {!readOnly && !showForm && (
          <button
            onClick={openFormNew}
            className="flex items-center gap-1 rounded-lg bg-[#ff5c00] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#e64a00]"
          >
            <Plus className="h-3 w-3" /> شرط جديد
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-gray-500">
        اجعل شراء لون نادر يستلزم شراء ألوان محددة معه. يمكنك إضافة عدة ألوان لنفس المشغّل.
      </p>

      {showForm && (
        <div className="mb-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          {presetTriggerId && (
            <div className="rounded-lg bg-blue-50 p-2 text-xs text-blue-800">
              إضافة ألوان إلى مجموعة: <strong>{variantLabel(presetTriggerId)}</strong>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">عند شراء</label>
              <select
                value={triggerId ?? ""}
                onChange={(e) => {
                  setTriggerId(e.target.value ? parseInt(e.target.value, 10) : null);
                  setRequiredId(null);
                }}
                disabled={!!presetTriggerId}
                className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs disabled:bg-gray-100"
              >
                <option value="">اختر...</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>{fmtAttrs(v.attributes)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">يجب إضافة</label>
              <select
                value={requiredId ?? ""}
                onChange={(e) => setRequiredId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs"
              >
                <option value="">اختر...</option>
                {availableRequiredForTrigger.map((v) => (
                  <option key={v.id} value={v.id}>{fmtAttrs(v.attributes)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">طريقة الشرط</label>
            <div className="space-y-1.5">
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-white p-2 hover:border-[#ff5c00]">
                <input
                  type="radio"
                  checked={!isMultiplied}
                  onChange={() => setIsMultiplied(false)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-900">حد أدنى ثابت</p>
                  <p className="text-[11px] text-gray-500">
                    أي كمية من الأول → نفس الحد الأدنى من الثاني
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-white p-2 hover:border-[#ff5c00]">
                <input
                  type="radio"
                  checked={isMultiplied}
                  onChange={() => setIsMultiplied(true)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-900 flex items-center gap-1">
                    <Ratio className="h-3 w-3" /> نسبة متضاعفة
                  </p>
                  <p className="text-[11px] text-gray-500">
                    كل قطعة من الأول → N من الثاني (تتضاعف مع الكمية)
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">
              {isMultiplied ? "المضاعف لكل قطعة" : "الحد الأدنى للكمية المطلوبة"}
            </label>
            <input
              type="number"
              min="1"
              max="10000"
              value={minQty}
              onChange={(e) => setMinQty(e.target.value)}
              className="w-24 rounded-lg border border-gray-200 bg-white p-1.5 text-xs"
            />
          </div>

          {triggerId && requiredId && (
            <div className="rounded-lg bg-orange-50 p-2 text-xs text-orange-800">
              <p className="font-bold">المعاينة:</p>
              {isMultiplied ? (
                <>
                  <p>• 1 {variantLabel(triggerId)} → {minQty} {variantLabel(requiredId)}</p>
                  <p>• 5 {variantLabel(triggerId)} → {parseInt(minQty, 10) * 5} {variantLabel(requiredId)}</p>
                </>
              ) : (
                <>
                  <p>• 1 أو أكثر {variantLabel(triggerId)} → {minQty} {variantLabel(requiredId)}</p>
                </>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-1 rounded bg-red-50 p-1.5 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="rounded-lg bg-[#ff5c00] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#e64a00] disabled:opacity-50"
            >
              {saving ? "..." : "حفظ"}
            </button>
            <button onClick={resetForm} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-white">
              إغلاق
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="py-2 text-center text-xs text-gray-400">لا توجد شروط</p>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.triggerVariantId);
            return (
              <div key={group.triggerVariantId} className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between gap-2 p-2">
                  <button
                    onClick={() => toggleGroup(group.triggerVariantId)}
                    className="flex flex-1 items-center gap-2 text-right"
                  >
                    {isCollapsed ? (
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                    ) : (
                      <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                    )}
                    <span className="text-xs font-bold text-gray-900">
                      عند شراء: {group.triggerLabel}
                    </span>
                    <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-[#ff5c00]">
                      {group.rules.length}
                    </span>
                  </button>
                  {!readOnly && (
                    <button
                      onClick={() => openFormWithTrigger(group.triggerVariantId)}
                      className="rounded p-1 text-[#ff5c00] hover:bg-orange-100"
                      title="إضافة لون آخر لنفس المشغّل"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="space-y-1 border-t border-gray-200 p-2">
                    {group.rules.map((rule) => (
                      <div key={rule.id} className="flex items-center justify-between gap-2 rounded bg-white p-2 text-xs">
                        <div className="flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-400">→</span>
                            <span className="font-medium text-gray-900">
                              {variantLabel(rule.requiredVariantId)}
                            </span>
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-700">
                              {rule.isMultiplied ? `${rule.minQuantity}×` : `≥${rule.minQuantity}`}
                            </span>
                            {rule.isMultiplied && (
                              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                                نسبة
                              </span>
                            )}
                          </div>
                        </div>
                        {!readOnly && (
                          <button
                            onClick={() => handleDelete(rule.id)}
                            disabled={deleting === rule.id}
                            className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
                            aria-label="حذف"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}