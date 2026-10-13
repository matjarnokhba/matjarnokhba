"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Package,
  User,
  Phone,
  MapPin,
  Store,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Truck,
  X,
  Check,
  RotateCcw,
  Clock,
} from "lucide-react";

const CURRENCY = "د.م";

type Props = {
  mode: "pickup" | "delivery" | "not_found";
  shipment: any;
  userRole: string;
};

export default function ReturnQRView({ mode, shipment, userRole }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // ═══ Reject modal ═══
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (mode === "not_found") {
    return (
      <div className="mx-auto max-w-lg p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
          <h2 className="mt-3 text-base font-black">رمز غير صحيح</h2>
          <Link
            href="/"
            className="mt-4 inline-block rounded-full bg-teal-600 px-6 py-2 text-xs font-bold text-white"
          >
            الرئيسية
          </Link>
        </div>
      </div>
    );
  }

  const ret = shipment.returnRequest;
  const order = ret.order;
  const customer = ret.user;
  const address = order.shippingAddressSnapshot || {};

  const status = shipment.status;
  const isCollector = userRole === "COLLECTOR";
  const isWarehouse =
    userRole === "WAREHOUSE_MANAGER" ||
    userRole === "ADMIN" ||
    userRole === "SUPER_ADMIN";
  const isSeller = userRole === "SELLER";
  const isCustomer = userRole === "CUSTOMER";
  const isDelivery = userRole === "DELIVERY";

  // ═══════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════
  async function handlePickup() {
    setSubmitting(true);
    setMessage(null);

    try {
      const token = shipment.pickupTokenPreview; // ⚠️ يحتاج الرمز الخام — من URL
      // ⚠️ we need the raw token — use the one from URL
      const url = window.location.pathname;
      const rawToken = url.split("/r/")[1];

      const res = await fetch(
        `/api/collector/returns/by-token/${rawToken}/pickup`,
        { method: "POST" }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "فشل" });
        return;
      }

      if (data.alreadyPicked) {
        setMessage({ type: "info", text: "تم استلام هذا المرتجع مسبقاً" });
      } else {
        setMessage({ type: "success", text: "✅ تم استلام المرتجع من العميل" });
      }

      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArrive() {
    setSubmitting(true);
    setMessage(null);

    try {
      const rawToken = window.location.pathname.split("/r/")[1];

      const res = await fetch(
        `/api/collector/returns/by-token/${rawToken}/arrive`,
        { method: "POST" }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "فشل" });
        return;
      }

      if (data.alreadyInTransit) {
        setMessage({ type: "info", text: "تم تسجيل الوصول مسبقاً" });
      } else {
        setMessage({ type: "success", text: "✅ تم تسجيل الوصول للمستودع" });
      }

      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSellerConfirm() {
    setSubmitting(true);
    setMessage(null);

    try {
      const rawToken = window.location.pathname.split("/r/")[1];

      const res = await fetch(
        `/api/seller/returns/by-token/${rawToken}/confirm`,
        { method: "POST" }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "فشل" });
        return;
      }

      if (data.alreadyConfirmed) {
        setMessage({ type: "info", text: "تم التأكيد مسبقاً" });
      } else {
        setMessage({
          type: "success",
          text: "✅ تم تأكيد استلام المرتجع",
        });
      }
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSellerReject() {
    if (rejectReason.trim().length < 5) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const rawToken = window.location.pathname.split("/r/")[1];

      const res = await fetch(
        `/api/seller/returns/by-token/${rawToken}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectReason }),
        }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "فشل" });
        return;
      }

      setMessage({
        type: "success",
        text: "✅ تم تسجيل الرفض — سيتم إبلاغ الإدارة",
      });
      setShowRejectModal(false);
      setRejectReason("");
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setSubmitting(false);
    }
  }

  // ═══════════════════════════════════════════
  // Action decisions
  // ═══════════════════════════════════════════
  let action: string | null = null;

  if (isCollector && mode === "pickup") {
    if (status === "PENDING_PICKUP") action = "collector_pickup";
    else if (status === "PICKED_UP") action = "collector_arrive";
    else if (status === "IN_TRANSIT_TO_WAREHOUSE") action = "wait_warehouse";
  }

  if (isSeller && mode === "delivery") {
    if (status === "IN_TRANSIT_TO_SELLER") action = "seller_confirm";
    else if (status === "COMPLETED") action = "already_completed";
    else if (status === "DELIVERED_TO_SELLER") action = "already_rejected";
  }

  // ═══════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════

  // Guard: only show QR content to relevant roles
  const canViewPickup =
    mode === "pickup" && (isCollector || isCustomer || isWarehouse);
  const canViewDelivery =
    mode === "delivery" && (isSeller || isDelivery || isWarehouse || isCollector);

  if (!canViewPickup && !canViewDelivery) {
    return (
      <div className="mx-auto max-w-lg p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
          <h2 className="mt-3 text-base font-black">لا يمكنك عرض هذا الرمز</h2>
          <p className="mt-2 text-xs text-gray-500">
            هذا الرمز مخصص لأدوار محددة فقط.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-full bg-teal-600 px-6 py-2 text-xs font-bold text-white"
          >
            الرئيسية
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pt-16 lg:p-8 lg:pt-8">
      {/* Header */}
      <div
        className="mb-4 rounded-2xl p-5 text-white shadow-md"
        style={{
          background:
            mode === "pickup"
              ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
              : "linear-gradient(135deg, #ea580c, #c2410c)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
            <RotateCcw className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-black">
              {mode === "pickup" ? "استلام المرتجع" : "تسليم المرتجع للتاجر"}
            </h1>
            <p className="mt-0.5 text-xs opacity-90">
              {shipment.returnNumber}
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-bold ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : message.type === "error"
                ? "bg-red-50 text-red-700"
                : "bg-blue-50 text-blue-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Return info */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-sm font-black">
            {shipment.returnNumber}
          </span>
          <ReturnStatusBadge status={status} />
        </div>

        <div className="border-t border-gray-100 pt-3">
          <div className="text-[11px] text-gray-500">الطلب الأصلي</div>
          <div className="font-mono text-sm font-bold">
            {order.orderNumber}
          </div>
        </div>
      </div>

      {/* Customer info */}
      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
          <User className="h-4 w-4 text-teal-600" />
          العميل
        </h2>
        <div className="space-y-2 text-sm">
          <div className="font-bold">{customer.name}</div>
          {customer.phone && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Phone className="h-3.5 w-3.5" />
              <span dir="ltr">{customer.phone}</span>
            </div>
          )}
          {address.city && (
            <div className="flex items-start gap-1.5 text-xs text-gray-600">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {address.street && `${address.street}، `}
                {address.district && `${address.district}، `}
                {address.city}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Reason */}
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-black text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          سبب الإرجاع
        </h2>
        <div className="text-sm text-amber-800">{ret.reason}</div>
      </div>

      {/* Items */}
      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-black">
          المنتجات ({ret.items.length})
        </h2>
        <div className="space-y-2">
          {ret.items.map((ri: any) => {
            const oi = ri.orderItem;
            return (
              <div
                key={ri.id}
                className="flex gap-3 rounded-xl border border-gray-100 p-3"
              >
                {oi.imageUrl ? (
                  <img
                    src={oi.imageUrl}
                    alt={oi.productName}
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <Package className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black">{oi.productName}</div>
                  {oi.variantName && (
                    <div className="mt-0.5 text-[10px] text-gray-500">
                      {oi.variantName}
                    </div>
                  )}
                  {oi.seller && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-600">
                      <Store className="h-3 w-3" />
                      {oi.seller.storeName}
                      {oi.seller.city && ` — ${oi.seller.city}`}
                    </div>
                  )}
                  <div className="mt-1">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      ×{ri.quantity}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ Actions ═══ */}
      {action === "collector_pickup" && (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50 p-5">
          <div className="mb-4 text-center text-sm font-black text-purple-900">
            هل استلمت المنتجات المُرجعة من العميل؟
          </div>
          <button
            onClick={handlePickup}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-purple-700 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Check className="h-5 w-5" />
            )}
            نعم — استلمت من العميل
          </button>
        </div>
      )}

      {action === "collector_arrive" && (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 p-5">
          <div className="mb-4 text-center text-sm font-black text-blue-900">
            هل وصلت إلى المستودع؟
          </div>
          <button
            onClick={handleArrive}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Truck className="h-5 w-5" />
            )}
            نعم — وصلت المستودع
          </button>
        </div>
      )}

      {action === "wait_warehouse" && (
        <div className="mt-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-5 text-center">
          <Clock className="mx-auto h-6 w-6 text-indigo-600" />
          <div className="mt-2 text-sm font-black text-indigo-900">
            📦 بانتظار المستودع
          </div>
          <p className="mt-1 text-xs text-indigo-700">
            تم تسليم المرتجع للمستودع
          </p>
        </div>
      )}

      {action === "seller_confirm" && (
        <div className="mt-4 space-y-2">
          <div className="rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 p-5">
            <div className="mb-4 text-center text-sm font-black text-orange-900">
              هل استلمت المنتجات المُرجعة؟
            </div>
            <button
              onClick={handleSellerConfirm}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              نعم — استلمت المرتجع
            </button>
          </div>

          <button
            onClick={() => setShowRejectModal(true)}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-500 bg-red-50 py-3.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
            لا — رفض الاستلام
          </button>
        </div>
      )}

      {action === "already_completed" && (
        <div className="mt-4 rounded-2xl border-2 border-green-200 bg-green-50 p-5 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-green-600" />
          <div className="mt-2 text-sm font-black text-green-900">
            ✅ تم إكمال الإرجاع
          </div>
          <p className="mt-1 text-xs text-green-700">
            هذا المرتجع مكتمل مسبقاً
          </p>
        </div>
      )}

      {action === "already_rejected" && (
        <div className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 p-5 text-center">
          <X className="mx-auto h-6 w-6 text-red-600" />
          <div className="mt-2 text-sm font-black text-red-900">
            تم رفض هذا المرتجع سابقاً
          </div>
          {shipment.sellerRejectionReason && (
            <p className="mt-1 text-xs text-red-700">
              السبب: {shipment.sellerRejectionReason}
            </p>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-red-700">
                رفض استلام المرتجع
              </h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-800">
              ⚠️ سيتم إبلاغ الإدارة بالرفض لاتخاذ الإجراء المناسب.
            </div>

            <label className="mb-1 block text-xs font-bold text-gray-700">
              السبب (إجباري)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="مثال: المنتج متضرر، غير مطابق، إلخ."
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:bg-white"
              autoFocus
            />
            <div className="mt-1 text-[10px] text-gray-500">
              {rejectReason.trim().length} / 5 حرفًا على الأقل
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={handleSellerReject}
                disabled={submitting || rejectReason.trim().length < 5}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                تأكيد الرفض
              </button>
              <button
                onClick={() => setShowRejectModal(false)}
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

function ReturnStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING_PICKUP: {
      label: "⏳ بانتظار الاستلام",
      cls: "bg-amber-100 text-amber-700",
    },
    PICKED_UP: { label: "📦 تم الاستلام", cls: "bg-blue-100 text-blue-700" },
    IN_TRANSIT_TO_WAREHOUSE: {
      label: "🚚 في الطريق",
      cls: "bg-indigo-100 text-indigo-700",
    },
    RECEIVED_AT_WAREHOUSE: {
      label: "📥 وصل المستودع",
      cls: "bg-teal-100 text-teal-700",
    },
    INSPECTED: { label: "✅ تم الفحص", cls: "bg-green-100 text-green-700" },
    IN_TRANSIT_TO_SELLER: {
      label: "🚚 إلى التاجر",
      cls: "bg-orange-100 text-orange-700",
    },
    DELIVERED_TO_SELLER: {
      label: "❌ رفض التاجر",
      cls: "bg-red-100 text-red-700",
    },
    COMPLETED: { label: "✅ مكتمل", cls: "bg-green-100 text-green-700" },
    CANCELLED: { label: "ملغى", cls: "bg-gray-100 text-gray-700" },
  };
  const info = map[status] || {
    label: status,
    cls: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${info.cls}`}
    >
      {info.label}
    </span>
  );
}