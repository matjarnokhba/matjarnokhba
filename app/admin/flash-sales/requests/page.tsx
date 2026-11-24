"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Flame, Loader2, XCircle } from "lucide-react";

type Req = {
  id: number;
  version: number;
  dealPrice: number | null;
  basePrice: number | null;
  quantityLimit: number | null;
  sale: { id: number; title: string; startsAt: string; endsAt: string };
  product: { id: number; name: string; image: string | null };
  seller: { id: number; storeName: string };
};

const money = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2)} د.م`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("ar-MA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AdminFlashRequestsPage() {
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [rejectFor, setRejectFor] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/flash-sales/requests", { cache: "no-store" });
      const j = await res.json();
      setRows(j.requests ?? j.data?.requests ?? []);
    } catch {
      setErr("تعذر تحميل الطلبات");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function review(r: Req, action: "APPROVE" | "REJECT") {
    setBusy(r.id);
    setErr("");
    try {
      const res = await fetch(`/api/admin/flash-sales/requests/${r.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, version: r.version, note: action === "REJECT" ? note.trim() || undefined : undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setErr(j.message || "تعذر تنفيذ القرار");
      else {
        setRejectFor(null);
        setNote("");
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-[#ff5c00]" />
          <h1 className="text-xl font-black text-gray-900">طلبات التجّار للعروض المحدودة</h1>
        </div>
        <Link
          href="/admin/flash-sales"
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
        >
          <ArrowRight className="h-3.5 w-3.5" /> الحملات
        </Link>
      </div>
      <p className="text-xs text-gray-500">
        يتحمل التاجر كامل الخصم في هذه الطلبات. عند الاعتماد يدخل المنتج الحملة ويظهر عند بدايتها.
      </p>

      {err && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{err}</div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-[#ff5c00]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center text-sm text-gray-500 shadow-sm">لا توجد طلبات بانتظار القرار.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const discount = r.basePrice != null && r.dealPrice != null ? r.basePrice - r.dealPrice : null;
            const pct = discount != null && r.basePrice ? Math.round((discount / r.basePrice) * 100) : null;
            return (
              <div key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {r.product.image && (
                      <img src={r.product.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{r.product.name}</div>
                    <div className="text-[11px] text-gray-500">التاجر: {r.seller.storeName}</div>
                    <div className="text-[11px] text-gray-500">
                      {r.sale.title} · {when(r.sale.startsAt)} → {when(r.sale.endsAt)}
                    </div>
                    <div className="mt-1 text-xs">
                      {r.dealPrice != null && <span className="font-black text-[#ff5c00]">{money(r.dealPrice)}</span>}
                      {r.basePrice != null && <span className="mr-2 text-gray-400 line-through">{money(r.basePrice)}</span>}
                      {pct != null && <span className="mr-2 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">-{pct}%</span>}
                      {r.quantityLimit != null && <span className="mr-2 text-gray-500">الكمية: {r.quantityLimit}</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  {rejectFor === r.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={300}
                        rows={2}
                        placeholder="سبب الرفض (اختياري، يصل التاجر)"
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs outline-none focus:border-[#ff5c00]"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy === r.id}
                          onClick={() => review(r, "REJECT")}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-600 py-2 text-xs font-bold text-white disabled:opacity-60"
                        >
                          {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                          تأكيد الرفض
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectFor(null);
                            setNote("");
                          }}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600"
                        >
                          رجوع
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => review(r, "APPROVE")}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#ff5c00] py-2 text-xs font-bold text-white disabled:opacity-60"
                      >
                        {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        اعتماد
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectFor(r.id);
                          setNote("");
                        }}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 py-2 text-xs font-bold text-gray-700"
                      >
                        <XCircle className="h-3.5 w-3.5" /> رفض
                      </button>
                    </div>
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