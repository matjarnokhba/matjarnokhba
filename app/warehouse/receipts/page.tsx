"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Package,
  Store,
  MapPin,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
  X,
  Send,
  User,
  Phone,
} from "lucide-react";

const CURRENCY = "د.م";

type Task = {
  orderId: number;
  orderNumber: string;
  seller: { id: number; storeName: string; city: string | null };
  itemsCount: number;
  status: string;
};

export default function WarehouseReceiptsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "ALL" | "IN_TRANSIT_TO_WAREHOUSE" | "RECEIVED" | "VERIFIED"
  >("ALL");

  const [rejectModal, setRejectModal] = useState<Task | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectAction, setRejectAction] = useState<"reject" | "postpone">(
    "reject"
  );
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/warehouse/tasks");
      const data = await res.json();
      if (data.success) {
        setTasks([
          ...(data.incoming || []),
          ...(data.received || []),
          ...(data.ready || []),
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered =
    filter === "ALL" ? tasks : tasks.filter((t) => t.status === filter);

  // ═══ إجراء سريع: فحص ═══
  async function handleVerify(orderId: number) {
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(
        `/api/warehouse/orders/${orderId}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify" }),
        }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "فشل الفحص" });
        return;
      }

      setMessage({
        type: "success",
        text: `✅ تم فحص الطلب ${data.orderNumber}`,
      });
      await load();
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setSubmitting(false);
    }
  }

  // ═══ إجراء: رفض/تأجيل ═══
  async function handleReject() {
    if (!rejectModal || rejectReason.trim().length < 5) return;

    setSubmitting(true);

    try {
      const res = await fetch(
        `/api/warehouse/orders/${rejectModal.orderId}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: rejectAction,
            reason: rejectReason,
            ...(rejectAction === "reject" && { returnToSeller: true }),
          }),
        }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "فشل الإجراء" });
        return;
      }

      setMessage({
        type: "success",
        text:
          rejectAction === "reject"
            ? `✅ تم رفض الطلب ${data.orderNumber} وإرجاعه للتاجر`
            : `✅ تم تأجيل الطلب ${data.orderNumber}`,
      });
      setRejectModal(null);
      setRejectReason("");
      await load();
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">الاستلامات</h1>
        <p className="mt-1 text-sm text-gray-500">{filtered.length} طرد</p>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-bold ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { key: "ALL", label: "الكل" },
          { key: "IN_TRANSIT_TO_WAREHOUSE", label: "في الطريق" },
          { key: "RECEIVED", label: "بانتظار الفحص" },
          { key: "VERIFIED", label: "تم الفحص" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === f.key
                ? "bg-teal-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Package className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">لا توجد استلامات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const canVerify = t.status === "RECEIVED";

            return (
              <div
                key={t.orderId}
                className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black">
                        {t.orderNumber}
                      </span>
                      <StatusBadge status={t.status} />
                    </div>

                    <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                      <Store className="h-3 w-3" />
                      {t.seller.storeName}
                    </div>

                    {t.seller.city && (
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                        <MapPin className="h-3 w-3" />
                        {t.seller.city}
                      </div>
                    )}

                    <div className="mt-1 text-[11px] text-gray-500">
                      {t.itemsCount} منتج
                    </div>
                  </div>
                </div>

                {/* ═══ Actions ═══ */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/warehouse/orders/${t.orderId}`}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    عرض التفاصيل
                  </Link>

                  {canVerify && (
                    <button
                      onClick={() => handleVerify(t.orderId)}
                      disabled={submitting}
                      className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      تم فحصه
                    </button>
                  )}

                  {canVerify && (
                    <button
                      onClick={() => {
                        setRejectModal(t);
                        setRejectReason("");
                        setRejectAction("reject");
                      }}
                      disabled={submitting}
                      className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      ليست كما هي
                    </button>
                  )}

                  {t.status === "VERIFIED" && (
                    <span className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      جاهز للشحن
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Reject Modal ═══ */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">الطلبية ليست كما هي</h3>
              <button
                onClick={() => setRejectModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mb-1 inline h-4 w-4" /> الطلب:{" "}
              <strong className="font-mono">{rejectModal.orderNumber}</strong>
              {" · "}
              {rejectModal.seller.storeName}
            </div>

            {/* Action choice */}
            <div className="mb-4">
              <label className="mb-2 block text-xs font-bold text-gray-700">
                الإجراء
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setRejectAction("reject")}
                  className={`rounded-xl border-2 p-3 text-center transition ${
                    rejectAction === "reject"
                      ? "border-red-500 bg-red-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <XCircle
                    className={`mx-auto h-5 w-5 ${
                      rejectAction === "reject"
                        ? "text-red-600"
                        : "text-gray-400"
                    }`}
                  />
                  <div className="mt-1 text-xs font-bold">رفض وإرجاع للتاجر</div>
                  <div className="mt-0.5 text-[10px] text-gray-500">
                    ترجع المنتجات للتاجر
                  </div>
                </button>

                <button
                  onClick={() => setRejectAction("postpone")}
                  className={`rounded-xl border-2 p-3 text-center transition ${
                    rejectAction === "postpone"
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <AlertTriangle
                    className={`mx-auto h-5 w-5 ${
                      rejectAction === "postpone"
                        ? "text-amber-600"
                        : "text-gray-400"
                    }`}
                  />
                  <div className="mt-1 text-xs font-bold">تأجيل</div>
                  <div className="mt-0.5 text-[10px] text-gray-500">
                    تبقى في المستودع
                  </div>
                </button>
              </div>
            </div>

            {/* Reason */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-bold text-gray-700">
                السبب (إجباري)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="مثال: منتج تالف، كمية ناقصة، منتج مختلف..."
                className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:bg-white"
                autoFocus
              />
              <div className="mt-1 text-[10px] text-gray-500">
                {rejectReason.trim().length} / 5 حرفًا على الأقل
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={submitting || rejectReason.trim().length < 5}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white transition disabled:opacity-50 ${
                  rejectAction === "reject"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : rejectAction === "reject" ? (
                  <Send className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                {rejectAction === "reject" ? "تأكيد الرفض" : "تأكيد التأجيل"}
              </button>
              <button
                onClick={() => setRejectModal(null)}
                disabled={submitting}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700"
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    IN_TRANSIT_TO_WAREHOUSE: {
      label: "في الطريق",
      cls: "bg-blue-100 text-blue-700",
    },
    RECEIVED: { label: "بانتظار الفحص", cls: "bg-amber-100 text-amber-700" },
    VERIFIED: { label: "تم الفحص", cls: "bg-green-100 text-green-700" },
    AVAILABLE_FOR_SHIPMENT: {
      label: "جاهز للشحن",
      cls: "bg-green-100 text-green-700",
    },
  };
  const info = map[status] || { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${info.cls}`}>
      {info.label}
    </span>
  );
}