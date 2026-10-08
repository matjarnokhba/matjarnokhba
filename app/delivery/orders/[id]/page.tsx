"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Package,
  User,
  Phone,
  MapPin,
  Check,
  Clock,
  XCircle,
  RotateCcw,
  AlertCircle,
  X,
} from "lucide-react";

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  total: number;
  subtotal: number;
  shippingCost: number;
  customerName: string;
  customerPhone: string | null;
  city: string | null;
  street: string | null;
  postalCode: string | null;
  assignedAt: string | null;
  createdAt: string;
  deliveredAt: string | null;
  items: {
    id: number;
    productName: string;
    variantName: string | null;
    imageUrl: string | null;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  attempts: {
    id: number;
    type: string;
    reason: string | null;
    createdAt: string;
  }[];
};

type ActionModal =
  | { type: "deferred" | "rejected" | "returned" | "delivered" }
  | null;

export default function DeliveryOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [actionModal, setActionModal] = useState<ActionModal>(null);
  const [reason, setReason] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "الطلب غير موجود");
        return;
      }
      setOrder(data.order);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (orderId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function executeAction(action: string, actionReason?: string) {
    if (!order) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/delivery/orders/${order.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(actionReason && { reason: actionReason }),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل التنفيذ");
        return;
      }

      setSuccessMsg(data.message || "تم بنجاح");
      setActionModal(null);
      setReason("");
      await load();

      setTimeout(() => {
        setSuccessMsg("");
        router.push("/delivery/orders");
      }, 2000);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-green-500" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-xl bg-red-50 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-3 text-lg font-black">{error}</h2>
          <Link
            href="/delivery/orders"
            className="mt-6 inline-block rounded-full bg-[#ff5c00] px-6 py-2.5 text-sm font-bold text-white"
          >
            عودة للطلبات
          </Link>
        </div>
      </div>
    );
  }

  const canAct = order.status === "SHIPPED" || order.status === "PROCESSING";

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/delivery/orders"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-green-600"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للطلبات
      </Link>

      {/* Header */}
      <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-gray-500">رقم الطلب</div>
            <div className="mt-1 font-mono text-xl font-black">
              {order.orderNumber}
            </div>
          </div>
          <StatusBadge status={order.status} />
        </div>
      </div>

      {/* النجاح */}
      {successMsg && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          <Check className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* العميل */}
      <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
          <User className="h-4 w-4 text-green-600" />
          بيانات العميل
        </h2>
        <div className="space-y-2 text-sm">
          <div className="font-bold">{order.customerName}</div>
          {order.customerPhone && (
            <a
              href={`tel:${order.customerPhone}`}
              className="flex items-center gap-2 text-xs text-green-600 hover:underline"
            >
              <Phone className="h-3.5 w-3.5" />
              <span dir="ltr">{order.customerPhone}</span>
            </a>
          )}
          {order.city && (
            <div className="flex items-start gap-2 text-xs text-gray-600">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {order.street}، {order.city}
                {order.postalCode && ` - ${order.postalCode}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* المنتجات */}
      <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
          <Package className="h-4 w-4 text-green-600" />
          المنتجات ({order.items.length})
        </h2>
        <div className="space-y-2">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 border-b border-gray-50 pb-2 last:border-0 last:pb-0"
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.productName}
                  className="h-12 w-12 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-gray-100">
                  <Package className="h-5 w-5 text-gray-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold">
                  {item.productName}
                </div>
                {item.variantName && (
                  <div className="text-[10px] text-gray-500">
                    {item.variantName}
                  </div>
                )}
              </div>
              <div className="text-xs font-bold text-gray-700">
                ×{item.quantity}
              </div>
            </div>
          ))}
        </div>

        {/* الإجمالي */}
        <div className="mt-4 space-y-1.5 border-t border-dashed border-gray-200 pt-3 text-xs">
          <div className="flex justify-between text-gray-500">
            <span>المجموع الفرعي</span>
            <span>{order.subtotal.toFixed(2)} د.م</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>الشحن</span>
            <span>
              {order.shippingCost === 0
                ? "مجاني"
                : `${order.shippingCost.toFixed(2)} د.م`}
            </span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-black">
            <span>المجموع المطلوب</span>
            <span className="text-[#ff5c00]">{order.total.toFixed(2)} د.م</span>
          </div>
        </div>
      </div>

      {/* سجل المحاولات */}
      {order.attempts.length > 0 && (
        <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-black">سجل المحاولات</h2>
          <div className="space-y-2">
            {order.attempts.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-2 rounded-lg bg-gray-50 p-2.5"
              >
                <AttemptIcon type={a.type} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold">
                    {attemptLabel(a.type)}
                  </div>
                  {a.reason && (
                    <div className="text-[10px] text-gray-500">{a.reason}</div>
                  )}
                  <div className="mt-0.5 text-[9px] text-gray-400">
                    {new Date(a.createdAt).toLocaleString("ar-MA")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* الإجراءات */}
      {canAct && (
        <div className="space-y-2">
          <button
            onClick={() => setActionModal({ type: "delivered" })}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 py-4 text-sm font-bold text-white shadow-md"
          >
            <Check className="h-5 w-5" />
            تم التوصيل
          </button>

          <button
            onClick={() => setActionModal({ type: "deferred" })}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-500 bg-amber-50 py-3.5 text-sm font-bold text-amber-700"
          >
            <Clock className="h-5 w-5" />
            تأجيل التوصيل
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActionModal({ type: "rejected" })}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-red-500 bg-red-50 py-3.5 text-sm font-bold text-red-700"
            >
              <XCircle className="h-5 w-5" />
              رفض العميل
            </button>

            <button
              onClick={() => setActionModal({ type: "returned" })}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-gray-400 bg-gray-50 py-3.5 text-sm font-bold text-gray-700"
            >
              <RotateCcw className="h-5 w-5" />
              إرجاع
            </button>
          </div>
        </div>
      )}

      {error && !order && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {/* Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            {actionModal.type === "delivered" ? (
              <>
                <div className="mb-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="mt-4 text-lg font-black">تأكيد التوصيل</h3>
                  <p className="mt-2 text-xs text-gray-600">
                    هل تم تسليم الطلب واستلام المبلغ (
                    {order.total.toFixed(2)} د.م)؟
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => executeAction("delivered")}
                    disabled={submitting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-500 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    نعم
                  </button>
                  <button
                    onClick={() => setActionModal(null)}
                    disabled={submitting}
                    className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-bold text-gray-700"
                  >
                    إلغاء
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-black">
                    {actionModal.type === "deferred"
                      ? "تأجيل التوصيل"
                      : actionModal.type === "rejected"
                        ? "رفض العميل"
                        : "إرجاع الطلب"}
                  </h3>
                  <button
                    onClick={() => setActionModal(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  placeholder="السبب..."
                  className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:bg-white"
                  autoFocus
                />
                {error && (
                  <div className="mt-2 text-xs text-red-600">{error}</div>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => executeAction(actionModal.type, reason)}
                    disabled={submitting || reason.trim().length < 3}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white disabled:opacity-50 ${
                      actionModal.type === "deferred"
                        ? "bg-amber-500"
                        : actionModal.type === "rejected"
                          ? "bg-red-500"
                          : "bg-gray-700"
                    }`}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "تأكيد"
                    )}
                  </button>
                  <button
                    onClick={() => setActionModal(null)}
                    disabled={submitting}
                    className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-bold text-gray-700"
                  >
                    إلغاء
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const info: Record<string, { label: string; cls: string }> = {
    PROCESSING: { label: "قيد التجهيز", cls: "bg-blue-100 text-blue-700" },
    SHIPPED: { label: "تم الشحن", cls: "bg-purple-100 text-purple-700" },
    DELIVERED: { label: "تم التسليم", cls: "bg-green-100 text-green-700" },
    RETURNED: { label: "مُرتجع", cls: "bg-red-100 text-red-700" },
  };
  const s = info[status] || { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${s.cls}`}>
      {s.label}
    </span>
  );
}

function AttemptIcon({ type }: { type: string }) {
  const map: Record<string, { icon: any; cls: string }> = {
    DELIVERED: { icon: Check, cls: "bg-green-100 text-green-600" },
    DEFERRED: { icon: Clock, cls: "bg-amber-100 text-amber-600" },
    REJECTED: { icon: XCircle, cls: "bg-red-100 text-red-600" },
    RETURNED: { icon: RotateCcw, cls: "bg-gray-100 text-gray-600" },
  };
  const item = map[type] || map.RETURNED;
  const Icon = item.icon;
  return (
    <div
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${item.cls}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </div>
  );
}

function attemptLabel(type: string): string {
  return (
    {
      DELIVERED: "تم التوصيل",
      DEFERRED: "تأجيل",
      REJECTED: "رفض العميل",
      RETURNED: "إرجاع",
    }[type] || type
  );
}