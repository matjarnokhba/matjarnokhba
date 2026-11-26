"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing";
import {
  PAYOUT_STATUS_LABEL,
  PAYOUT_METHOD_LABEL,
  type PayoutStatus,
} from "@/lib/refund-payout-status";

type Row = {
  id: number;
  method: string;
  status: PayoutStatus;
  amount: number | null;
  bankName: string | null;
  holderNameMasked: string;
  ribMasked: string | null;
  reference: string | null;
  createdAt: string;
  orderId: number;
  orderNumber: string;
  customer: { name: string | null; phone: string | null } | null;
};

type Detail = Row & {
  holderName: string | null;
  rib: string | null;
  cinImageUrl: string | null;
  proofUrl: string | null;
  adminNote: string | null;
  sentAt: string | null;
  completedAt: string | null;
};

const TABS: PayoutStatus[] = ["PROCESSING", "SENT", "COMPLETED"];

function fmt(s: string | null) {
  return s ? new Date(s).toLocaleString("ar-MA") : "—";
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="break-all text-left font-bold" dir="ltr">
        {value || "—"}
      </span>
    </div>
  );
}

function DetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { startUpload } = useUploadThing("payoutProofUploader", {
    onUploadError: (e) => setErr(e.message || "فشل رفع الملف"),
  });

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/refund-payouts/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.success) setD(j.payout);
        else setErr(j.message || "فشل التحميل");
      })
      .catch(() => alive && setErr("فشل الاتصال"));
    return () => {
      alive = false;
    };
  }, [id]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/refund-payouts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok || !j.success) {
        setErr(j.message || "فشل التنفيذ");
        return;
      }
      onChanged();
      onClose();
    } catch {
      setErr("فشل الاتصال");
    } finally {
      setBusy(false);
    }
  }

  async function onProof(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    setUploading(true);
    try {
      const res = await startUpload([file]);
      if (res?.[0]) setProof(res[0].url);
    } catch {
      setErr("فشل رفع الملف");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-5" dir="rtl">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-black">استرداد مبلغ الإرجاع</h3>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!d && !err && (
            <div className="flex justify-center p-6">
              <Loader2 className="h-6 w-6 animate-spin text-[#ff5c00]" />
            </div>
          )}
          {d && (
            <>
              <Field label="الحالة" value={PAYOUT_STATUS_LABEL[d.status]} />
              <Field label="الطريقة" value={PAYOUT_METHOD_LABEL[d.method] ?? d.method} />
              <Field label="المبلغ المستحق" value={d.amount === null ? null : `${d.amount.toFixed(2)} د.م`} />
              <Field label="الطلب" value={d.orderNumber} />
              <Field label="الزبون" value={d.customer?.name ?? null} />
              <Field label="هاتف الزبون" value={d.customer?.phone ?? null} />
              <Field label="الاسم الكامل" value={d.holderName} />
              {d.method === "BANK" && (
                <>
                  <Field label="البنك" value={d.bankName} />
                  <Field label="RIB" value={d.rib} />
                </>
              )}
              {d.method !== "BANK" && (
                <div className="border-b border-gray-100 py-2 text-sm">
                  <div className="mb-1 text-gray-500">صورة البطاقة الوطنية</div>
                  {d.cinImageUrl ? (
                    <a href={d.cinImageUrl} target="_blank" rel="noreferrer" className="font-bold text-[#ff5c00] underline">
                      فتح الصورة
                    </a>
                  ) : (
                    <span className="text-gray-400">لم يرفعها الزبون</span>
                  )}
                </div>
              )}
              {d.reference && <Field label="مرجع التحويل" value={d.reference} />}
              {d.proofUrl && (
                <div className="border-b border-gray-100 py-2 text-sm">
                  <a href={d.proofUrl} target="_blank" rel="noreferrer" className="font-bold text-[#ff5c00] underline">
                    عرض إثبات الدفع
                  </a>
                </div>
              )}
              {d.adminNote && <Field label="ملاحظة" value={d.adminNote} />}
              <Field label="تاريخ الإرسال" value={d.sentAt ? fmt(d.sentAt) : null} />
              <Field label="تاريخ الاكتمال" value={d.completedAt ? fmt(d.completedAt) : null} />

              {d.status === "PROCESSING" && (
                <div className="mt-4 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    maxLength={100}
                    placeholder="مرجع عملية التحويل (إجباري)"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
                  />
                  <div>
                    <div className="mb-1 text-[11px] font-bold text-gray-700">إثبات الدفع (صورة أو PDF — اختياري)</div>
                    {proof ? (
                      <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                        <span>تم رفع الإثبات</span>
                        <button type="button" onClick={() => setProof("")} className="font-bold text-red-600">
                          إزالة
                        </button>
                      </div>
                    ) : (
                      <input type="file" accept="image/*,application/pdf" onChange={onProof} disabled={uploading || busy} className="block w-full text-xs text-gray-600" />
                    )}
                    {uploading && <div className="mt-1 text-[10px] text-gray-500">جارٍ الرفع...</div>}
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="ملاحظة (اختيارية)"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
                  />
                  <button
                    disabled={busy || uploading || reference.trim().length < 3}
                    onClick={() =>
                      act({
                        action: "mark_sent",
                        reference: reference.trim(),
                        proofUrl: proof || undefined,
                        adminNote: note.trim() || undefined,
                      })
                    }
                    className="w-full rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy ? "جارٍ الحفظ..." : "تم إرسال المبلغ"}
                  </button>
                </div>
              )}

              {d.status === "SENT" && (
                <button
                  disabled={busy}
                  onClick={() => act({ action: "complete" })}
                  className="mt-4 w-full rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy ? "جارٍ الحفظ..." : "تأكيد اكتمال الاسترداد"}
                </button>
              )}
            </>
          )}
          {err && <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{err}</div>}
        </div>
      </div>
    </div>
  );
}

export default function AdminRefundPayoutsPage() {
  const [tab, setTab] = useState<PayoutStatus>("PROCESSING");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/refund-payouts?status=${tab}`);
      const data = await res.json();
      if (data.success) setRows(data.payouts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <h1 className="mb-4 text-2xl font-black">استرداد مبالغ الزبائن</h1>
      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold ${tab === t ? "bg-[#ff5c00] text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {PAYOUT_STATUS_LABEL[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-500">لا توجد عمليات في هذه الحالة</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => setOpenId(r.id)}
              className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white p-4 text-right transition hover:bg-gray-50"
            >
              <div>
                <div className="text-sm font-black">
                  {PAYOUT_METHOD_LABEL[r.method] ?? r.method} — {r.amount === null ? "—" : `${r.amount.toFixed(2)} د.م`}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  الطلب {r.orderNumber} · {r.customer?.name ?? r.holderNameMasked}
                  {r.ribMasked ? ` · ${r.ribMasked}` : ""}
                </div>
              </div>
              <div className="text-xs font-bold text-gray-600">{fmt(r.createdAt)}</div>
            </button>
          ))}
        </div>
      )}

      {openId !== null && <DetailModal id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}