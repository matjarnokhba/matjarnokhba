"use client";

import { useState } from "react";
import { RotateCcw, Loader2, Search } from "lucide-react";

const CURRENCY = "د.م";

type SaleItem = {
  id: number;
  productName: string;
  optionsLabel?: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  returned: number;
  remaining: number;
};

type Lookup = {
  sale: { id: number; receiptNumber: string; createdAt: string; total: number; customerName?: string | null; customerPhone?: string | null };
  window: { days: number; deadline: string; expired: boolean };
  items: SaleItem[];
};

type Line = { qty: number; condition: "RESELLABLE" | "DEFECTIVE"; note: string };

const EMPTY_LINE: Line = { qty: 0, condition: "RESELLABLE", note: "" };

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function PosReturnsPage() {
  const [receipt, setReceipt] = useState("");
  const [data, setData] = useState<Lookup | null>(null);
  const [lines, setLines] = useState<Record<number, Line>>({});
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function search(r?: string) {
    const q = (r ?? receipt).trim();
    setError(null);
    if (!r) setDone(null);
    setLoading(true);
    try {
      const res = await fetch("/api/seller/store-sales/lookup?receipt=" + encodeURIComponent(q), { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.success === false) {
        setData(null);
        setError(j?.message || j?.error || (res.status === 403 ? "ليست لديك صلاحية إرجاع بيع المحل." : "تعذر البحث."));
      } else {
        setData(j as Lookup);
        setLines({});
        setReason("");
      }
    } catch {
      setError("تعذر الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  }

  function setLine(id: number, patch: Partial<Line>) {
    setLines((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? EMPTY_LINE), ...patch },
    }));
  }

  const chosen = (data?.items ?? [])
    .map((it) => ({ it, l: lines[it.id] }))
    .filter((x) => x.l && x.l.qty > 0);
  const refund = chosen.reduce((s, x) => s + x.l.qty * x.it.unitPrice, 0);
  const defectNoteMissing = chosen.some((x) => x.l.condition === "DEFECTIVE" && x.l.note.trim().length < 3);
  const canSubmit = !!data && !data.window.expired && chosen.length > 0 && !defectNoteMissing && !saving;

  async function submit() {
    if (!data || !canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/seller/store-sale-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeSaleId: data.sale.id,
          reason: reason.trim() || null,
          items: chosen.map((x) => ({
            storeSaleItemId: x.it.id,
            quantity: x.l.qty,
            condition: x.l.condition,
            note: x.l.note.trim() || null,
          })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.success === false) {
        setError(j?.message || j?.error || "تعذر تنفيذ الإرجاع.");
      } else {
        const r = j.result || {};
        setDone(
          "تم الإرجاع. المبلغ المردود نقداً: " + Number(r.refundTotal ?? refund).toFixed(2) + " " + CURRENCY +
            " • للمخزون: " + (r.resellableQty ?? 0) + " • معيب: " + (r.defectiveQty ?? 0)
        );
        await search(data.sale.receiptNumber);
      }
    } catch {
      setError("تعذر الاتصال بالخادم.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto" dir="rtl">
      <div className="flex items-center gap-2 mb-4">
        <RotateCcw className="w-6 h-6 text-[#ff5c00]" />
        <h1 className="text-xl font-bold">إرجاع من بيع المحل</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="flex gap-2 mb-4"
      >
        <input
          value={receipt}
          onChange={(e) => setReceipt(e.target.value)}
          placeholder="رقم الإيصال"
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
          dir="ltr"
        />
        <button
          type="submit"
          disabled={loading || receipt.trim().length < 4}
          className="px-4 py-2 rounded-lg bg-[#ff5c00] text-white text-sm disabled:opacity-50 flex items-center gap-1"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          بحث
        </button>
      </form>

      {error && <div className="rounded-lg bg-red-50 text-red-700 p-3 text-sm mb-3">{error}</div>}
      {done && <div className="rounded-lg bg-green-50 text-green-700 p-3 text-sm mb-3">{done}</div>}

      {data && (
        <div className="space-y-3">
          <div className="rounded-xl border bg-white p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold" dir="ltr">{data.sale.receiptNumber}</span>
              <span>{data.sale.total.toFixed(2)} {CURRENCY}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {fmtDate(data.sale.createdAt)}
              {data.sale.customerName ? " • " + data.sale.customerName : ""}
              {data.sale.customerPhone ? " • " + data.sale.customerPhone : ""}
            </div>
            <div className={"text-xs mt-2 " + (data.window.expired ? "text-red-600" : "text-gray-600")}>
              {data.window.expired
                ? "انتهت مدة الإرجاع (" + data.window.days + " أيام)"
                : "مدة الإرجاع " + data.window.days + " أيام — حتى " + fmtDate(data.window.deadline)}
            </div>
          </div>

          {data.items.map((it) => {
            const l = lines[it.id] ?? { qty: 0, condition: "RESELLABLE" as const, note: "" };
            const disabled = it.remaining <= 0 || data.window.expired;
            return (
              <div key={it.id} className={"rounded-xl border bg-white p-3 " + (disabled ? "opacity-60" : "")}>
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{it.productName}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {[it.optionsLabel, it.sku].filter(Boolean).join(" • ")}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 shrink-0 text-left">
                    <div>{it.unitPrice.toFixed(2)} {CURRENCY}</div>
                    <div>بيع {it.quantity} • أُرجع {it.returned} • متبقٍ {it.remaining}</div>
                  </div>
                </div>
                {!disabled && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="text-xs text-gray-600">
                      الكمية
                      <input
                        type="number"
                        min={0}
                        max={it.remaining}
                        value={l.qty}
                        onChange={(e) =>
                          setLine(it.id, { qty: Math.max(0, Math.min(it.remaining, Math.floor(Number(e.target.value) || 0))) })
                        }
                        className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm"
                        dir="ltr"
                      />
                    </label>
                    <label className="text-xs text-gray-600">
                      الحالة
                      <select
                        value={l.condition}
                        onChange={(e) => setLine(it.id, { condition: e.target.value as Line["condition"] })}
                        className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                      >
                        <option value="RESELLABLE">صالحة للبيع</option>
                        <option value="DEFECTIVE">معيبة</option>
                      </select>
                    </label>
                    {l.condition === "DEFECTIVE" && l.qty > 0 && (
                      <input
                        value={l.note}
                        onChange={(e) => setLine(it.id, { note: e.target.value })}
                        placeholder="وصف العيب (إجباري)"
                        maxLength={300}
                        className="col-span-2 border rounded-lg px-2 py-1.5 text-sm"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="سبب الإرجاع (اختياري)"
            maxLength={500}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />

          <div className="flex items-center justify-between rounded-xl bg-orange-50 p-3">
            <span className="text-sm">المبلغ المردود نقداً</span>
            <span className="font-bold text-[#ff5c00]">{refund.toFixed(2)} {CURRENCY}</span>
          </div>

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full py-3 rounded-xl bg-[#ff5c00] text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            تأكيد الإرجاع
          </button>
        </div>
      )}
    </div>
  );
}