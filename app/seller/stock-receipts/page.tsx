"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, PackagePlus, FileText, Check, X } from "lucide-react";
import { STOCK_SOURCE_LABELS } from "@/lib/stock-labels";
import StockReceiptEditForm from "@/components/seller/StockReceiptEditForm";

type Person = { id: number; name: string | null } | null;
type Item = {
  id: number;
  productName: string | null;
  optionsLabel: string;
  quantity: number;
  approvedQuantity: number | null;
  adjustmentReason: string | null;
  unitCost: number | null;
};
type Receipt = {
  id: number;
  status: string;
  sourceType: string;
  sourceName: string | null;
  sourcePhone: string | null;
  sourceNote: string | null;
  totalCost: number | null;
  invoiceUrl: string | null;
  invoiceName: string | null;
  purchasedBy: Person;
  receivedBy: Person;
  enteredBy: Person;
  decidedBy: Person;
  decidedAt: string | null;
  rejectionReason: string | null;
  canEdit?: boolean;
  edited?: boolean;
  createdAt: string;
  items: Item[];
};

const TABS: { value: string; label: string }[] = [
  { value: "PENDING", label: "بانتظار الموافقة" },
  { value: "APPROVED", label: "معتمدة" },
  { value: "REJECTED", label: "مرفوضة" },
];
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "بانتظار الموافقة", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "معتمد", cls: "bg-green-100 text-green-700" },
  REJECTED: { label: "مرفوض", cls: "bg-red-100 text-red-700" },
};
const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#ff5c00]";

function who(p: Person) {
  return p ? p.name || `#${p.id}` : "غير محدد";
}

function ReceiptCard({ r, canApprove, onChanged }: { r: Receipt; canApprove: boolean; onChanged: () => void }) {
  const [qty, setQty] = useState<Record<number, string>>(() => Object.fromEntries(r.items.map((i) => [i.id, String(i.quantity)])));
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [rejecting, setRejecting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const badge = STATUS_BADGE[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-700" };
  if (editing) {
    return (
      <StockReceiptEditForm
        receipt={r}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  async function call(path: string, body: unknown) {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/seller/stock-receipts/${r.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        setErr(json.message || "تعذر تنفيذ العملية");
        return;
      }
      onChanged();
    } catch {
      setErr("فشل الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  }

  function approve() {
    const adjustments: { itemId: number; approvedQuantity: number; reason: string | null }[] = [];
    for (const it of r.items) {
      const n = Number(qty[it.id]);
      if (!Number.isInteger(n) || n < 0) return setErr("الكمية المعتمدة غير صالحة");
      if (n !== it.quantity) {
        const reason = (reasons[it.id] || "").trim();
        if (reason.length < 3) return setErr("اكتب سبب تعديل الكمية (خطأ في الكتابة أو غيره)");
        adjustments.push({ itemId: it.id, approvedQuantity: n, reason });
      }
    }
    call("approve", { adjustments });
  }

  function reject() {
    if (rejectReason.trim().length < 3) return setErr("اكتب سبب الرفض");
    call("reject", { reason: rejectReason.trim() });
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-black text-gray-900">طلب #{r.id}</div>
        <span className="flex items-center gap-2">
          {r.edited && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">عُدّل بعد الإرسال</span>
          )}
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badge.cls}`}>{badge.label}</span>
          {r.canEdit && (
            <button type="button" onClick={() => setEditing(true)} className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-700 transition hover:border-[#ff5c00] hover:text-[#ff5c00]">
              تعديل
            </button>
          )}
        </span>
      </div>

      <div className="mb-3 grid gap-1 text-xs text-gray-600">
        <div>المصدر: <b>{STOCK_SOURCE_LABELS[r.sourceType] ?? r.sourceType}</b>{r.sourceName ? ` — ${r.sourceName}` : ""}{r.sourcePhone ? ` (${r.sourcePhone})` : ""}</div>
        {r.sourceNote && <div>ملاحظات: {r.sourceNote}</div>}
        {r.totalCost != null && <div>التكلفة الإجمالية: {r.totalCost} د.م</div>}
        <div>اشتراها: {who(r.purchasedBy)} · استلمها: {who(r.receivedBy)} · سجّلها: {who(r.enteredBy)}</div>
        <div>التاريخ: {new Date(r.createdAt).toLocaleString("ar")}</div>
        {r.invoiceUrl && (
          <a href={r.invoiceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-[#ff5c00]">
            <FileText className="h-3.5 w-3.5" />
            {r.invoiceName || "عرض الفاتورة"}
          </a>
        )}
      </div>

      <div className="space-y-2">
        {r.items.map((it) => {
          const changed = r.status === "PENDING" && canApprove && Number(qty[it.id]) !== it.quantity;
          return (
            <div key={it.id} className="rounded-lg border border-gray-100 p-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-gray-900">
                  {it.productName} {it.optionsLabel && <span className="text-gray-500">· {it.optionsLabel}</span>}
                </div>
                {r.status === "PENDING" && canApprove ? (
                  <label className="flex items-center gap-1.5 text-gray-600">
                    المعتمد
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={qty[it.id] ?? ""}
                      onChange={(e) => setQty({ ...qty, [it.id]: e.target.value })}
                      className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-center text-sm font-bold outline-none focus:border-[#ff5c00]"
                    />
                    <span className="text-gray-400">من {it.quantity}</span>
                  </label>
                ) : (
                  <div className="text-gray-700">
                    المُدخل: <b>{it.quantity}</b>
                    {it.approvedQuantity != null && <> · المعتمد: <b>{it.approvedQuantity}</b></>}
                  </div>
                )}
              </div>
              {changed && (
                <input
                  value={reasons[it.id] ?? ""}
                  onChange={(e) => setReasons({ ...reasons, [it.id]: e.target.value })}
                  className={`${inputCls} mt-2`}
                  placeholder="سبب تعديل الكمية (خطأ في الكتابة أو غيره)"
                  maxLength={300}
                />
              )}
              {it.adjustmentReason && <div className="mt-1 text-amber-700">سبب التعديل: {it.adjustmentReason}</div>}
            </div>
          );
        })}
      </div>

      {r.status !== "PENDING" && (
        <div className="mt-3 text-xs text-gray-600">
          {r.status === "APPROVED" ? "اعتمده" : "رفضه"}: <b>{who(r.decidedBy)}</b>
          {r.decidedAt ? ` · ${new Date(r.decidedAt).toLocaleString("ar")}` : ""}
          {r.rejectionReason && <div className="mt-1 text-red-700">سبب الرفض: {r.rejectionReason}</div>}
        </div>
      )}

      {err && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {r.status === "PENDING" && canApprove && (
        <div className="mt-3">
          {rejecting ? (
            <div className="space-y-2">
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className={inputCls} rows={2} placeholder="سبب الرفض" maxLength={500} />
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={reject} className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  تأكيد الرفض
                </button>
                <button type="button" onClick={() => setRejecting(false)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700">رجوع</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={approve} className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                اعتماد
              </button>
              <button type="button" disabled={busy} onClick={() => setRejecting(true)} className="flex items-center gap-1 rounded-lg border border-red-200 px-4 py-2 text-xs font-bold text-red-600">
                <X className="h-3.5 w-3.5" />
                رفض
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StockReceiptsPage() {
  const [tab, setTab] = useState("PENDING");
  const [rows, setRows] = useState<Receipt[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canApprove, setCanApprove] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCanApprove(!!d?.user?.canApproveStock))
      .catch(() => setCanApprove(false));
  }, []);

  const load = useCallback(
    async (status: string, pageNo: number, append: boolean) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/seller/stock-receipts?status=${status}&page=${pageNo}&limit=20`);
        const json = await res.json();
        if (!json.success) {
          setError(json.message || "تعذر التحميل");
          return;
        }
        setTotal(json.total);
        setPage(pageNo);
        setRows((prev) => (append ? [...prev, ...json.receipts] : json.receipts));
      } catch {
        setError("فشل الاتصال بالخادم");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(tab, 1, false);
  }, [tab, load]);

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 pb-8 pt-16 sm:px-4 lg:px-8 lg:pt-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff4ed]">
          <PackagePlus className="h-5 w-5 text-[#ff5c00]" />
        </span>
        <div>
          <h1 className="text-xl font-black text-gray-900">طلبات المخزون</h1>
          <p className="text-sm text-gray-500">الإضافات الواردة وحالتها</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${
              tab === t.value ? "bg-[#ff5c00] text-white" : "bg-white text-gray-600 shadow-sm"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-4 text-center text-sm font-bold text-red-700">{error}</div>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <ReceiptCard key={`${r.id}-${r.status}`} r={r} canApprove={canApprove} onChanged={() => load(tab, 1, false)} />
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-7 w-7 animate-spin text-[#ff5c00]" />
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-xl bg-white p-10 text-center text-sm text-gray-500 shadow-sm">لا توجد طلبات في هذا التبويب</div>
      )}

      {!loading && rows.length < total && (
        <div className="mt-4 text-center">
          <button type="button" onClick={() => load(tab, page + 1, true)} className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-xs font-bold text-gray-700">
            تحميل المزيد
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-[11px] text-gray-400">
        لإضافة مخزون جديد افتح المنتج من <Link href="/seller/products" className="font-bold text-[#ff5c00]">منتجاتي</Link> ثم اضغط «إضافة مخزون».
      </p>
    </div>
  );
}