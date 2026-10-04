"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, Loader2, ArrowRight, Palette } from "lucide-react";

type ValueItem = {
  id: number;
  value: string;
  colorHex: string | null;
  status: string;
  attributeName: string;
  attributeId: number;
  categoryName: string;
  sellerId: number;
  sellerName: string;
  sellerSlug: string;
};

export default function AdminAttributeValuesPage() {
  const [values, setValues] = useState<ValueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"PENDING" | "APPROVED" | "REJECTED">(
    "PENDING"
  );
  const [processing, setProcessing] = useState<number | null>(null);
  const [rejectModal, setRejectModal] = useState<ValueItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function load(status: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/attribute-values?status=${status}`);
      const data = await res.json();
      if (data.success) {
        setValues(data.values);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(tab);
  }, [tab]);

  async function handleApprove(id: number) {
    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/attribute-values/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();
      if (data.success) {
        setValues((prev) => prev.filter((v) => v.id !== id));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject() {
    if (!rejectModal || !rejectReason.trim()) return;
    setProcessing(rejectModal.id);
    try {
      const res = await fetch(
        `/api/admin/attribute-values/${rejectModal.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject",
            reason: rejectReason.trim(),
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setValues((prev) => prev.filter((v) => v.id !== rejectModal.id));
        setRejectModal(null);
        setRejectReason("");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Palette className="h-6 w-6 text-[#ff5c00]" />
          قيم الخصائص
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          راجع القيم التي أضافها التجار قبل نشرها لكل التجار
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              tab === t
                ? "bg-[#ff5c00] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t === "PENDING"
              ? "بانتظار المراجعة"
              : t === "APPROVED"
                ? "مقبولة"
                : "مرفوضة"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : values.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-gray-500">
            لا توجد قيم {tab === "PENDING" ? "بانتظار المراجعة" : ""}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {values.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 shadow-sm"
            >
              {/* القيمة */}
              <div className="flex items-center gap-2">
                {v.colorHex ? (
                  <span
                    className="h-8 w-8 rounded-full border border-gray-200"
                    style={{ backgroundColor: v.colorHex }}
                  />
                ) : (
                  <span className="rounded-lg bg-[#fff4ed] px-3 py-1.5 text-sm font-bold text-[#ff5c00]">
                    {v.value}
                  </span>
                )}
                {v.colorHex && (
                  <span className="text-sm font-bold text-gray-900">
                    {v.value}
                  </span>
                )}
              </div>

              {/* التفاصيل */}
              <div className="flex-1 text-xs">
                <div className="font-bold text-gray-700">
                  خاصية: {v.attributeName}
                </div>
                <div className="text-gray-500">
                  فئة: {v.categoryName} · تاجر: {v.sellerName}
                </div>
              </div>

              {/* الإجراءات */}
              {tab === "PENDING" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(v.id)}
                    disabled={processing === v.id}
                    className="flex items-center gap-1 rounded-lg bg-green-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-600 disabled:opacity-50"
                  >
                    {processing === v.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    موافقة
                  </button>
                  <button
                    onClick={() => setRejectModal(v)}
                    disabled={processing === v.id}
                    className="flex items-center gap-1 rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    رفض
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal الرفض */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h3 className="text-lg font-black">رفض القيمة</h3>
            <p className="mt-2 text-sm text-gray-600">
              القيمة: <strong>{rejectModal.value}</strong>
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="سبب الرفض..."
              rows={3}
              className="mt-3 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || processing !== null}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {processing !== null ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "تأكيد الرفض"
                )}
              </button>
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason("");
                }}
                disabled={processing !== null}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}