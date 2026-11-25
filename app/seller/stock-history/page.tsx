"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, ChevronRight, ChevronLeft } from "lucide-react";

type PersonLike = string | { name?: string | null } | null | undefined;

type Movement = {
  id: string;
  createdAt: string;
  type: string;
  typeLabel?: string;
  bucket?: string;
  product?: {
    variantId?: number;
    name?: string;
    optionsLabel?: string | null;
    sku?: string | null;
  };
  beforeQuantity: number;
  afterQuantity: number;
  quantityChange: number;
  reason?: string | null;
  performedBy?: PersonLike;
  source?: { type?: string | null; label?: string | null; referenceId?: string | number | null };
  receipt?: { sourceLabel?: string; sourceName?: string | null; invoiceUrl?: string | null };
  sale?: { receiptNumber?: string | null; customerName?: string | null };
  saleReturn?: { receiptNumber?: string | null; reason?: string | null; condition?: string | null };
};

const LIMIT = 30;

function personName(p: PersonLike): string | null {
  if (!p) return null;
  if (typeof p === "string") return p;
  return p.name ?? null;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function SellerStockHistoryPage() {
  const [bucket, setBucket] = useState<"" | "SELLABLE" | "DEFECTIVE">("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (bucket) qs.set("bucket", bucket);
      const res = await fetch("/api/seller/inventory-movements?" + qs.toString(), { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        setError(data?.error || data?.message || (res.status === 403 ? "ليست لديك صلاحية عرض سجل المخزون." : "تعذر تحميل السجل."));
        setRows([]);
        setTotal(0);
      } else {
        setRows(Array.isArray(data.movements) ? data.movements : []);
        setTotal(Number(data.total) || 0);
      }
    } catch {
      setError("تعذر الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  }, [page, bucket]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / LIMIT));

  const tabs: { key: "" | "SELLABLE" | "DEFECTIVE"; label: string }[] = [
    { key: "", label: "الكل" },
    { key: "SELLABLE", label: "قابل للبيع" },
    { key: "DEFECTIVE", label: "معيب" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-6 h-6 text-[#ff5c00]" />
        <h1 className="text-xl font-bold">سجل المخزون</h1>
      </div>

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key || "all"}
            onClick={() => {
              setBucket(t.key);
              setPage(1);
            }}
            className={
              "px-3 py-1.5 rounded-full text-sm border " +
              (bucket === t.key
                ? "bg-[#ff5c00] text-white border-[#ff5c00]"
                : "bg-white text-gray-700 border-gray-300")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#ff5c00]" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 text-red-700 p-4 text-sm">{error}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg bg-gray-50 text-gray-500 p-8 text-center text-sm">لا توجد حركات مخزون بعد.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((m) => {
            const ch = m.quantityChange;
            const who = personName(m.performedBy);
            const extra: string[] = [];
            if (m.source?.label) extra.push(m.source.label);
            if (m.receipt?.sourceName) extra.push("المصدر: " + m.receipt.sourceName);
            if (m.sale?.receiptNumber) extra.push("فاتورة: " + m.sale.receiptNumber);
            if (m.saleReturn?.receiptNumber) extra.push("إرجاع فاتورة: " + m.saleReturn.receiptNumber);
            if (m.saleReturn?.reason) extra.push("السبب: " + m.saleReturn.reason);
            if (m.reason) extra.push(m.reason);
            return (
              <div key={m.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{m.product?.name ?? "—"}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {[m.product?.optionsLabel, m.product?.sku].filter(Boolean).join(" • ")}
                    </div>
                  </div>
                  <div
                    className={
                      "text-lg font-bold shrink-0 " +
                      (ch > 0 ? "text-green-600" : ch < 0 ? "text-red-600" : "text-gray-500")
                    }
                    dir="ltr"
                  >
                    {ch > 0 ? "+" + ch : String(ch)}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-orange-50 text-[#ff5c00]">
                    {m.typeLabel ?? m.type}
                  </span>
                  {m.bucket === "DEFECTIVE" && (
                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600">معيب</span>
                  )}
                  <span className="text-gray-600" dir="ltr">
                    {m.beforeQuantity} → {m.afterQuantity}
                  </span>
                  <span className="text-gray-400">{fmtDate(m.createdAt)}</span>
                </div>
                {(extra.length > 0 || who) && (
                  <div className="mt-2 text-xs text-gray-500">
                    {extra.join(" • ")}
                    {who ? (extra.length > 0 ? " • " : "") + "بواسطة: " + who : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && total > LIMIT && (
        <div className="flex items-center justify-center gap-4 mt-5">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="p-2 rounded-lg border disabled:opacity-40"
            aria-label="السابق"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600">
            {page} / {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="p-2 rounded-lg border disabled:opacity-40"
            aria-label="التالي"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}