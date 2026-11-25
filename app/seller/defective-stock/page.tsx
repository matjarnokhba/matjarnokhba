"use client";

import { useCallback, useEffect, useState } from "react";
import { PackageX, Loader2 } from "lucide-react";

type Item = {
  variantId: number;
  productName: string;
  optionsLabel?: string;
  sku?: string | null;
  defective: number;
  sellable: number;
};

type Form = { qty: number; action: "WRITE_OFF" | "RESTOCK"; reason: string };
const EMPTY_FORM: Form = { qty: 1, action: "WRITE_OFF", reason: "" };

export default function DefectiveStockPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [forms, setForms] = useState<Record<number, Form>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/seller/defective-stock", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.success === false) {
        setError(j?.message || "تعذر تحميل القائمة.");
        setItems([]);
      } else {
        setError(null);
        setItems(Array.isArray(j.items) ? j.items : []);
      }
    } catch {
      setError("تعذر الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setForm(id: number, patch: Partial<Form>) {
    setForms((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_FORM), ...patch } }));
  }

  async function submit(it: Item) {
    const f = forms[it.variantId] ?? EMPTY_FORM;
    setBusy(it.variantId);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/seller/defective-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: it.variantId, quantity: f.qty, action: f.action, reason: f.reason }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.success === false) {
        setError(j?.message || "تعذر التنفيذ.");
      } else {
        setDone(f.action === "WRITE_OFF" ? "تم إتلاف " + f.qty + " قطعة." : "أُعيدت " + f.qty + " قطعة للمخزون القابل للبيع.");
        setForms((prev) => ({ ...prev, [it.variantId]: EMPTY_FORM }));
        await load();
      }
    } catch {
      setError("تعذر الاتصال بالخادم.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto" dir="rtl">
      <div className="flex items-center gap-2 mb-1">
        <PackageX className="w-6 h-6 text-[#ff5c00]" />
        <h1 className="text-xl font-bold">سلة المعيب</h1>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        السلع المعيبة لا تُباع. يمكنك إتلافها، أو إعادتها للبيع بعد إصلاحها. كل عملية تُسجَّل في سجل المخزون.
      </p>

      {error && <div className="rounded-lg bg-red-50 text-red-700 p-3 text-sm mb-3">{error}</div>}
      {done && <div className="rounded-lg bg-green-50 text-green-700 p-3 text-sm mb-3">{done}</div>}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#ff5c00]" />
        </div>
      ) : items.length === 0 && !error ? (
        <div className="rounded-lg bg-gray-50 text-gray-500 p-8 text-center text-sm">لا توجد سلع معيبة حالياً.</div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const f = forms[it.variantId] ?? EMPTY_FORM;
            const invalid = f.qty < 1 || f.qty > it.defective || f.reason.trim().length < 3;
            return (
              <div key={it.variantId} className="rounded-xl border bg-white p-3">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{it.productName}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {[it.optionsLabel, it.sku].filter(Boolean).join(" • ")}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 shrink-0 text-left">
                    <div className="text-red-600 font-semibold">معيب: {it.defective}</div>
                    <div>قابل للبيع: {it.sellable}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-600">
                    الكمية
                    <input
                      type="number"
                      min={1}
                      max={it.defective}
                      value={f.qty}
                      onChange={(e) =>
                        setForm(it.variantId, { qty: Math.max(0, Math.min(it.defective, Math.floor(Number(e.target.value) || 0))) })
                      }
                      className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm"
                      dir="ltr"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    الإجراء
                    <select
                      value={f.action}
                      onChange={(e) => setForm(it.variantId, { action: e.target.value as Form["action"] })}
                      className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                    >
                      <option value="WRITE_OFF">إتلاف</option>
                      <option value="RESTOCK">إصلاح وإعادة للبيع</option>
                    </select>
                  </label>
                  <input
                    value={f.reason}
                    onChange={(e) => setForm(it.variantId, { reason: e.target.value })}
                    placeholder="السبب (إجباري)"
                    maxLength={300}
                    className="col-span-2 border rounded-lg px-2 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => submit(it)}
                    disabled={invalid || busy === it.variantId}
                    className="col-span-2 py-2 rounded-lg bg-[#ff5c00] text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {busy === it.variantId && <Loader2 className="w-4 h-4 animate-spin" />}
                    تنفيذ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}