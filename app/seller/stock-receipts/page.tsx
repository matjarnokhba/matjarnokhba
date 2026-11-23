"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, PackagePlus, FileText, Check, X, Package } from "lucide-react";
import { STOCK_SOURCE_LABELS } from "@/lib/stock-labels";
import StockReceiptEditForm from "@/components/seller/StockReceiptEditForm";

type PersonRef = { id: number; name: string | null } | null;
type Item = {
  id: number;
  productName: string | null;
  productImage: string | null;
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
  purchasedBy: PersonRef;
  receivedBy: PersonRef;
  enteredBy: PersonRef;
  decidedBy: PersonRef;
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

function who(p: PersonRef) {
  return p ? p.name || `#${p.id}` : "غير محدد";
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <div className="text-[10px] font-bold text-gray-400">{label}</div>
      <div className="mt-0.5 truncate text-xs font-black text-gray-900">{value}</div>
    </div>
  );
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

  const deciding = r.status === "PENDING" && canApprove;
  const totalQty = r.items.reduce((s, i) => s + i.quantity, 0);
  const totalApproved = r.items.reduce((s, i) => s + (i.approvedQuantity ?? 0), 0);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      {/* الرأس */}
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
        <div>
          <div className="text-sm font-black text-gray-900">طلب #{r.id}</div>
          <div className="mt-0.5 text-[11px] text-gray-500">{new Date(r.createdAt).toLocaleString("ar")}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {r.edited && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">عُدّل بعد الإرسال</span>
          )}
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badge.cls}`}>{badge.label}</span>
          {r.canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-700 transition hover:border-[#ff5c00] hover:text-[#ff5c00]"
            >
              تعديل
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* المنتجات */}
        <div className="space-y-2.5">
          {r.items.map((it) => {
            const changed = deciding && Number(qty[it.id]) !== it.quantity;
            return (
              <div key={it.id} className="rounded-xl border border-gray-100 p-2.5">
                <div className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {it.productImage ? (
                      <img src={it.productImage} alt={it.productName ?? "منتج"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <Package className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-[13px] font-black leading-snug text-gray-900">{it.productName ?? "منتج"}</div>
                    {it.optionsLabel && (
                      <span className="mt-1 inline-block rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-700">{it.optionsLabel}</span>
                    )}
                    <div className="mt-1 text-[11px] text-gray-500">
                      المُدخل: <b className="text-gray-900">{it.quantity}</b>
                      {it.unitCost != null && <> · تكلفة الوحدة {it.unitCost} د.م</>}
                    </div>
                  </div>
                </div>

                {deciding ? (
                  <>
                    <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
                      <span className="text-xs font-bold text-gray-700">الكمية المعتمدة</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={qty[it.id] ?? ""}
                        onChange={(e) => setQty({ ...qty, [it.id]: e.target.value })}
                        className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center text-sm font-black outline-none focus:border-[#ff5c00]"
                      />
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
                  </>
                ) : (
                  it.approvedQuantity != null && (
                    <div className="mt-2.5 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
                      الكمية المعتمدة: <b className="text-gray-900">{it.approvedQuantity}</b>
                    </div>
                  )
                )}
                {it.adjustmentReason && (
                  <div className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">سبب التعديل: {it.adjustmentReason}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* الملخص */}
        <div className="flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="rounded-full bg-[#fff4ed] px-3 py-1 text-[#ff5c00]">إجمالي القطع: {totalQty}</span>
          {r.status === "APPROVED" && (
            <span className="rounded-full bg-green-50 px-3 py-1 text-green-700">المضاف فعلياً: {totalApproved}</span>
          )}
          {r.totalCost != null && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">التكلفة الإجمالية: {r.totalCost} د.م</span>
          )}
        </div>

        {/* المصدر */}
        <div className="rounded-xl bg-[#fff8f3] px-3 py-2.5 text-xs text-gray-700">
          <div className="text-[10px] font-bold text-gray-400">مصدر المخزون</div>
          <div className="mt-0.5 font-black text-gray-900">
            {STOCK_SOURCE_LABELS[r.sourceType] ?? r.sourceType}
            {r.sourceName ? ` — ${r.sourceName}` : ""}
          </div>
          {r.sourcePhone && <div className="mt-0.5 text-gray-600" dir="ltr" style={{ textAlign: "right" }}>{r.sourcePhone}</div>}
          {r.sourceNote && <div className="mt-1 text-gray-600">{r.sourceNote}</div>}
        </div>

        {/* الأشخاص */}
        <div className="grid grid-cols-2 gap-2">
          <Cell label="اشتراها" value={who(r.purchasedBy)} />
          <Cell label="استلمها" value={who(r.receivedBy)} />
          <Cell label="سجّلها في النظام" value={who(r.enteredBy)} />
          {r.status !== "PENDING" && <Cell label={r.status === "APPROVED" ? "اعتمدها" : "رفضها"} value={who(r.decidedBy)} />}
        </div>

        {r.invoiceUrl && (
          <a
            href={r.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-bold text-[#ff5c00] transition hover:bg-[#fff4ed]"
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{r.invoiceName || "عرض الفاتورة"}</span>
          </a>
        )}

        {r.status !== "PENDING" && (
          <div className="text-[11px] text-gray-500">
            {r.decidedAt ? new Date(r.decidedAt).toLocaleString("ar") : ""}
            {r.rejectionReason && (
              <div className="mt-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">سبب الرفض: {r.rejectionReason}</div>
            )}
          </div>
        )}

        {err && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        {deciding && (
          <div>
            {rejecting ? (
              <div className="space-y-2">
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className={inputCls} rows={2} placeholder="سبب الرفض" maxLength={500} />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy} onClick={reject} className="flex items-center justify-center gap-1 rounded-xl bg-red-600 py-2.5 text-xs font-black text-white disabled:opacity-60">
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    تأكيد الرفض
                  </button>
                  <button type="button" onClick={() => setRejecting(false)} className="rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-700">رجوع</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={busy} onClick={approve} className="flex items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2.5 text-xs font-black text-white disabled:opacity-60">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  اعتماد
                </button>
                <button type="button" disabled={busy} onClick={() => setRejecting(true)} className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 py-2.5 text-xs font-black text-red-600">
                  <X className="h-3.5 w-3.5" />
                  رفض
                </button>
              </div>
            )}
          </div>
        )}
      </div>
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

      <div className="mx-auto max-w-2xl space-y-4">
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
        لإضافة مخزون جديد افتح <Link href="/seller/products" className="font-bold text-[#ff5c00]">منتجاتي</Link> واضغط أيقونة المخزون (+) على المنتج.
      </p>
    </div>
  );
}