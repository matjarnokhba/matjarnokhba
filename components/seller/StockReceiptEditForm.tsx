"use client";

import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import DocumentUploader from "@/components/seller/DocumentUploader";
import { STOCK_SOURCE_LABELS } from "@/lib/stock-labels";

type EditItem = {
  id: number;
  productName: string | null;
  optionsLabel: string;
  quantity: number;
  unitCost: number | null;
};

export type EditableReceipt = {
  id: number;
  sourceType: string;
  sourceName: string | null;
  sourcePhone: string | null;
  sourceNote: string | null;
  totalCost: number | null;
  invoiceUrl: string | null;
  invoiceName: string | null;
  items: EditItem[];
};

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#ff5c00]";

export default function StockReceiptEditForm({
  receipt,
  onCancel,
  onSaved,
}: {
  receipt: EditableReceipt;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [sourceType, setSourceType] = useState(receipt.sourceType);
  const [sourceName, setSourceName] = useState(receipt.sourceName ?? "");
  const [sourcePhone, setSourcePhone] = useState(receipt.sourcePhone ?? "");
  const [sourceNote, setSourceNote] = useState(receipt.sourceNote ?? "");
  const [totalCost, setTotalCost] = useState(receipt.totalCost != null ? String(receipt.totalCost) : "");
  const [invoice, setInvoice] = useState<{ url: string; name: string | null } | null>(
    receipt.invoiceUrl ? { url: receipt.invoiceUrl, name: receipt.invoiceName } : null
  );
  const [qty, setQty] = useState<Record<number, string>>(
    Object.fromEntries(receipt.items.map((i) => [i.id, String(i.quantity)]))
  );
  const [cost, setCost] = useState<Record<number, string>>(
    Object.fromEntries(receipt.items.map((i) => [i.id, i.unitCost != null ? String(i.unitCost) : ""]))
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const lockedSource = receipt.sourceType === "PLATFORM_TRANSFER";
  const sourceOptions = Object.entries(STOCK_SOURCE_LABELS).filter(
    ([k]) => k !== "PLATFORM_TRANSFER" || lockedSource
  );

  async function save() {
    setErr("");
    for (const it of receipt.items) {
      const n = Number(qty[it.id]);
      if (qty[it.id] === "" || !Number.isInteger(n) || n < 0) return setErr("الكمية يجب أن تكون عدداً صحيحاً (0 لإلغاء الخيار)");
      const c = cost[it.id];
      if (c !== "" && (!Number.isFinite(Number(c)) || Number(c) < 0)) return setErr("تكلفة الوحدة غير صالحة");
    }
    if (receipt.items.every((it) => Number(qty[it.id]) === 0)) return setErr("يجب أن تبقى كمية واحدة على الأقل");
    if (totalCost !== "" && (!Number.isFinite(Number(totalCost)) || Number(totalCost) < 0)) {
      return setErr("التكلفة الإجمالية غير صالحة");
    }
    if (sourceType === "OTHER" && !sourceNote.trim() && !sourceName.trim()) return setErr("اكتب تفاصيل المصدر");

    setBusy(true);
    try {
      const res = await fetch(`/api/seller/stock-receipts/${receipt.id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          sourceName: sourceName.trim() || null,
          sourcePhone: sourcePhone.trim() || null,
          sourceNote: sourceNote.trim() || null,
          totalCost: totalCost === "" ? null : Number(totalCost),
          invoiceUrl: invoice?.url ?? null,
          invoiceName: invoice?.name ?? null,
          items: receipt.items.map((it) => ({
            itemId: it.id,
            quantity: Number(qty[it.id]),
            unitCost: cost[it.id] === "" ? null : Number(cost[it.id]),
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setErr(json.message || "تعذر حفظ التعديل");
        return;
      }
      onSaved();
    } catch {
      setErr("فشل الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#ff5c00]/30 bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm font-black text-gray-900">تعديل الطلب #{receipt.id}</div>
      <p className="mb-3 text-[11px] text-gray-500">يمكنك التعديل ما دام الطلب بانتظار موافقة صاحب المتجر.</p>

      <div className="space-y-2">
        {receipt.items.map((it) => (
          <div key={it.id} className="rounded-lg border border-gray-100 p-2.5">
            <div className="mb-2 text-xs font-bold text-gray-900">
              {it.productName} {it.optionsLabel && <span className="text-gray-500">· {it.optionsLabel}</span>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-bold text-gray-600">
                الكمية (0 لإلغاء الخيار)
                <input type="number" min={0} step={1} inputMode="numeric" value={qty[it.id] ?? ""} onChange={(e) => setQty({ ...qty, [it.id]: e.target.value })} className={`${inputCls} mt-1`} />
              </label>
              <label className="text-[11px] font-bold text-gray-600">
                تكلفة الوحدة
                <input type="number" min={0} step="0.01" inputMode="decimal" value={cost[it.id] ?? ""} onChange={(e) => setCost({ ...cost, [it.id]: e.target.value })} className={`${inputCls} mt-1`} />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} disabled={lockedSource} className={inputCls}>
          {sourceOptions.map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} className={inputCls} placeholder="اسم الجهة" maxLength={200} />
        <input value={sourcePhone} onChange={(e) => setSourcePhone(e.target.value)} className={inputCls} placeholder="هاتف الجهة (اختياري)" maxLength={40} inputMode="tel" />
        <textarea value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} className={inputCls} rows={2} placeholder={sourceType === "OTHER" ? "تفاصيل المصدر (مطلوب)" : "ملاحظات (اختياري)"} maxLength={1000} />
        <input type="number" min={0} step="0.01" inputMode="decimal" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} className={inputCls} placeholder="التكلفة الإجمالية للفاتورة (اختياري)" />
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[11px] font-bold text-gray-600">الفاتورة</div>
        {invoice ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            <span className="truncate">{invoice.name || "فاتورة مرفقة"}</span>
            <button type="button" onClick={() => setInvoice(null)} className="font-bold underline">إزالة</button>
          </div>
        ) : (
          <DocumentUploader
            onSuccess={(f) => setInvoice({ url: f.url, name: f.name })}
            onError={(m) => setErr(m)}
            disabled={busy}
          />
        )}
      </div>

      {err && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button type="button" disabled={busy} onClick={save} className="flex items-center gap-1 rounded-lg bg-[#ff5c00] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          حفظ التعديل
        </button>
        <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700">
          إلغاء
        </button>
      </div>
    </div>
  );
}