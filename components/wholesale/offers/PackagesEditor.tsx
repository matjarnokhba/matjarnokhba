"use client";

import { useState } from "react";
import { Plus, Trash2, AlertCircle, Boxes, X } from "lucide-react";

type OfferVariant = { id: number; attributes: Array<{ name: string; value: string }> };
type PackageItem = { variantId: number; quantity: number };
type OfferPackage = { id: number; name: string; sortOrder: number; items: PackageItem[] };

type Props = {
  offerId: number;
  variants: OfferVariant[];
  initialPackages: OfferPackage[];
  readOnly?: boolean;
};

function fmtAttrs(attrs: Array<{ name: string; value: string }>): string {
  if (!attrs || attrs.length === 0) return "افتراضي";
  return attrs.map((a) => `${a.name}: ${a.value}`).join(" · ");
}

export default function PackagesEditor({ offerId, variants, initialPackages, readOnly }: Props) {
  const [packages, setPackages] = useState<OfferPackage[]>(initialPackages || []);
  const [showForm, setShowForm] = useState(false);
  const [pkgName, setPkgName] = useState("");
  const [qtyMap, setQtyMap] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState("");

  const variantLabel = (id: number): string => {
    const v = variants.find((x) => x.id === id);
    return v ? fmtAttrs(v.attributes) : `#${id}`;
  };

  function resetForm() {
    setShowForm(false);
    setPkgName("");
    setQtyMap({});
    setError("");
  }

  function updateQty(variantId: number, val: string) {
    if (val !== "" && !/^\d+$/.test(val)) return;
    setQtyMap((prev) => {
      const next = { ...prev };
      if (val === "" || val === "0") delete next[variantId];
      else next[variantId] = val;
      return next;
    });
  }

  async function handleAdd() {
    setError("");
    if (!pkgName.trim()) { setError("اسم الحزمة مطلوب"); return; }
    const items = Object.entries(qtyMap)
      .map(([vid, q]) => ({ variantId: parseInt(vid, 10), quantity: parseInt(q || "0", 10) }))
      .filter((i) => i.quantity > 0);
    if (items.length === 0) { setError("أضف كمية لخيار واحد على الأقل"); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/wholesale/offers/${offerId}/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: pkgName.trim(), items }),
      });
      const d = await res.json();
      if (d.success) {
        setPackages((prev) => [...prev, d.package]);
        resetForm();
      } else {
        setError(d.message || "فشل الحفظ");
      }
    } catch { setError("خطأ في الاتصال"); }
    finally { setSaving(false); }
  }

  async function handleDelete(pkgId: number) {
    if (!confirm("حذف هذه الحزمة؟")) return;
    setDeleting(pkgId);
    setError("");
    try {
      const res = await fetch(`/api/wholesale/offers/${offerId}/packages/${pkgId}`, { method: "DELETE" });
      const d = await res.json();
      if (d.success) setPackages((prev) => prev.filter((p) => p.id !== pkgId));
      else setError(d.message || "فشل");
    } catch { setError("خطأ في الاتصال"); }
    finally { setDeleting(null); }
  }

  const totalPiecesInForm = Object.values(qtyMap).reduce(
    (s, q) => s + (parseInt(q || "0", 10) || 0), 0
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <Boxes className="h-4 w-4 text-[#ff5c00]" />
          حزم جاهزة ({packages.length})
        </h3>
        {!readOnly && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 rounded-lg bg-[#ff5c00] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#e64a00]"
          >
            <Plus className="h-3 w-3" /> حزمة جديدة
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-gray-500">
        عرّف حزمًا جاهزة (مثل: "طقم 3 قطع" أو "عرض 13 قطعة") — المشتري يضيفها بضغطة واحدة.
      </p>

      {showForm && (
        <div className="mb-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium">اسم الحزمة</label>
            <input
              type="text"
              value={pkgName}
              onChange={(e) => setPkgName(e.target.value)}
              placeholder="مثال: طقم 3 قطع"
              className="w-full rounded-lg border border-gray-200 bg-white p-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">
              الكميات (اترك 0 للاستبعاد)
            </label>
            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
              {variants.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex-1 truncate">{fmtAttrs(v.attributes)}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={qtyMap[v.id] || ""}
                    onChange={(e) => updateQty(v.id, e.target.value)}
                    className="w-16 rounded border border-gray-200 p-1 text-center text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          {totalPiecesInForm > 0 && (
            <div className="rounded-lg bg-orange-50 p-2 text-xs text-orange-800">
              إجمالي القطع في الحزمة: <strong>{totalPiecesInForm}</strong>
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
              إلغاء
            </button>
          </div>
        </div>
      )}

      {packages.length === 0 ? (
        <p className="py-2 text-center text-xs text-gray-400">لا توجد حزم</p>
      ) : (
        <div className="space-y-1.5">
          {packages.map((pkg) => {
            const totalPieces = pkg.items.reduce((s, i) => s + i.quantity, 0);
            return (
              <div key={pkg.id} className="rounded-lg border border-gray-200 bg-white p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-bold text-gray-900">{pkg.name}</span>
                      <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-[#ff5c00]">
                        {totalPieces}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-600">
                      {pkg.items.map((i) => `${i.quantity}× ${variantLabel(i.variantId)}`).join(" · ")}
                    </p>
                  </div>
                  {!readOnly && (
                    <button
                      onClick={() => handleDelete(pkg.id)}
                      disabled={deleting === pkg.id}
                      className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
                      aria-label="حذف"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}