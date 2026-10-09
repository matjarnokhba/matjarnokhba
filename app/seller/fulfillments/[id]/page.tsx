"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Truck,
  User,
  Phone,
  MapPin,
  X,
} from "lucide-react";

type Fulfillment = {
  id: number;
  orderItemId: number;
  sellerId: number;
  quantity: number;
  status: string;
  deadline: string | null;
  preparedAt: string | null;
  preparedById: number | null;
  readyAt: string | null;
  collectedAt: string | null;
  collectedById: number | null;
  departedAt: string | null;
  warehouseReceivedAt: string | null;
  warehouseReceivedById: number | null;
  verifiedAt: string | null;
  verifiedById: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  orderItem: {
    id: number;
    productName: string;
    variantName: string | null;
    sku: string;
    imageUrl: string | null;
    quantity: number;
    unitPrice: string;
    total: string;
    order: {
      id: number;
      orderNumber: string;
      source: string;
      status: string;
      createdAt: string;
      customerSnapshot: any;
      shippingAddressSnapshot: any;
    };
    product: {
      id: number;
      name: string;
      slug: string;
    };
  };
  seller: {
    id: number;
    storeName: string;
    slug: string;
  };
  history: {
    id: number;
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    createdAt: string;
  }[];
  warehouseReceipts: {
    id: number;
    receiptNumber: string;
    quantity: number;
    status: string;
    receivedAt: string;
    verifiedAt: string | null;
    damagedQuantity: number;
    rejectionReason: string | null;
  }[];
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "بانتظار التجهيز", cls: "bg-blue-100 text-blue-700" },
  PREPARING: { label: "قيد التجهيز", cls: "bg-amber-100 text-amber-700" },
  READY_FOR_COLLECTION: {
    label: "جاهز للجمع",
    cls: "bg-purple-100 text-purple-700",
  },
  COLLECTED: { label: "تم الجمع", cls: "bg-indigo-100 text-indigo-700" },
  IN_TRANSIT_TO_WAREHOUSE: {
    label: "في الطريق للمستودع",
    cls: "bg-indigo-100 text-indigo-700",
  },
  RECEIVED: { label: "في المستودع", cls: "bg-cyan-100 text-cyan-700" },
  VERIFIED: { label: "تم التحقق", cls: "bg-teal-100 text-teal-700" },
  AVAILABLE_FOR_SHIPMENT: {
    label: "متاح للشحن",
    cls: "bg-green-100 text-green-700",
  },
  ALLOCATED: { label: "في شحنة", cls: "bg-green-100 text-green-700" },
  SHIPPED: { label: "تم الشحن", cls: "bg-green-100 text-green-700" },
  DELIVERED: { label: "تم التسليم", cls: "bg-green-200 text-green-800" },
  CANCELLED: { label: "ملغى", cls: "bg-gray-100 text-gray-600" },
  RETURNED: { label: "مُرجع", cls: "bg-red-100 text-red-700" },
};

type ActionModal = "start_preparing" | "mark_ready" | null;

export default function SellerFulfillmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const fulfillmentId = params.id as string;

  const [item, setItem] = useState<Fulfillment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [actionModal, setActionModal] = useState<ActionModal>(null);
  const [note, setNote] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/seller/fulfillments/${fulfillmentId}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "عنصر التجهيز غير موجود");
        return;
      }

      setItem(data.fulfillment);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (fulfillmentId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfillmentId]);

  async function executeTransition(
    toStatus: "PREPARING" | "READY_FOR_COLLECTION",
    noteText?: string
  ) {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(
        `/api/seller/fulfillments/${fulfillmentId}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toStatus,
            note: noteText || undefined,
          }),
        }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحديث");
        return;
      }

      setSuccessMsg("تم تحديث الحالة بنجاح");
      setActionModal(null);
      setNote("");
      await load();

      setTimeout(() => setSuccessMsg(""), 3000);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (error && !item) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-xl bg-red-50 p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-3 text-lg font-black">{error}</h2>
          <Link
            href="/seller/fulfillments"
            className="mt-6 inline-block rounded-full bg-[#ff5c00] px-6 py-2.5 text-sm font-bold text-white"
          >
            عودة للتجهيزات
          </Link>
        </div>
      </div>
    );
  }

  if (!item) return null;

  const statusInfo = STATUS_LABELS[item.status] || STATUS_LABELS.PENDING;
  const order = item.orderItem.order;
  const address = order.shippingAddressSnapshot || {};
  const isOnline = order.source === "ONLINE";

  const canStartPreparing = item.status === "PENDING";
  const canMarkReady = item.status === "PREPARING";
  const isOverdue =
    item.deadline &&
    new Date(item.deadline) < new Date() &&
    ["PENDING", "PREPARING"].includes(item.status);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/seller/fulfillments"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للتجهيزات
      </Link>

      {/* Header */}
      <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-black text-gray-900">
                {order.orderNumber}
              </span>
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isOnline
                    ? "bg-blue-50 text-blue-700"
                    : "bg-[#fff4ed] text-[#ff5c00]"
                }`}
              >
                {isOnline ? "🌐 إلكتروني" : "🏪 محل"}
              </span>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {new Date(order.createdAt).toLocaleString("ar-MA")}
            </div>
          </div>

          <span
            className={`rounded-full px-4 py-2 text-xs font-bold ${statusInfo.cls}`}
          >
            {statusInfo.label}
          </span>
        </div>

        {isOverdue && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <strong>متأخر!</strong> تجاوزت المهلة. جهّز العنصر بأسرع
              وقت.
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-xs text-green-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Product */}
      <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-black">
          <Package className="h-4 w-4 text-[#ff5c00]" />
          المنتج
        </h2>

        <div className="flex items-start gap-3">
          {item.orderItem.imageUrl ? (
            <img
              src={item.orderItem.imageUrl}
              alt={item.orderItem.productName}
              className="h-20 w-20 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-gray-100">
              <Package className="h-8 w-8 text-gray-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black">
              {item.orderItem.productName}
            </div>
            {item.orderItem.variantName && (
              <div className="mt-0.5 text-xs text-gray-500">
                {item.orderItem.variantName}
              </div>
            )}
            <div className="mt-1 font-mono text-[10px] text-gray-400">
              {item.orderItem.sku}
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <div>
                <div className="text-[10px] text-gray-500">
                  الكمية المطلوبة
                </div>
                <div className="text-lg font-black text-[#ff5c00]">
                  {item.quantity}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500">السعر</div>
                <div className="text-xs font-bold">
                  {Number(item.orderItem.unitPrice).toFixed(2)} د.م
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deadline */}
      {item.deadline && ["PENDING", "PREPARING"].includes(item.status) && (
        <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
            <Clock className="h-4 w-4 text-[#ff5c00]" />
            المهلة
          </h2>
          <div className="text-sm">
            {new Date(item.deadline).toLocaleString("ar-MA", {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </div>
        </div>
      )}

      {/* Customer (لطلبات IN_STORE فقط) */}
      {!isOnline && address.fullName && (
        <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-black">
            <User className="h-4 w-4 text-[#ff5c00]" />
            بيانات العميل
          </h2>
          <div className="space-y-2 text-sm">
            <div className="font-bold">{address.fullName}</div>
            {address.phone && (
              <div
                className="flex items-center gap-2 text-xs text-gray-600"
                dir="ltr"
              >
                <Phone className="h-3.5 w-3.5" />
                {address.phone}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {(canStartPreparing || canMarkReady) && (
        <div className="mb-5 space-y-2">
          {canStartPreparing && (
            <button
              onClick={() => setActionModal("start_preparing")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 py-4 text-sm font-bold text-white shadow-md transition hover:opacity-95"
            >
              <Package className="h-5 w-5" />
              بدء التجهيز
            </button>
          )}

          {canMarkReady && (
            <button
              onClick={() => setActionModal("mark_ready")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 py-4 text-sm font-bold text-white shadow-md transition hover:opacity-95"
            >
              <CheckCircle2 className="h-5 w-5" />
              جاهز للجمع
            </button>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-black">
          <Truck className="h-4 w-4 text-[#ff5c00]" />
          سجل الحالة
        </h2>

        {item.history.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-400">
            لا يوجد سجل بعد
          </div>
        ) : (
          <div className="space-y-3">
            {item.history.map((h) => {
              const info =
                STATUS_LABELS[h.toStatus] || STATUS_LABELS.PENDING;
              return (
                <div key={h.id} className="flex gap-3">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${info.cls}`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold">{info.label}</div>
                    {h.note && (
                      <div className="mt-0.5 text-[10px] text-gray-500">
                        {h.note}
                      </div>
                    )}
                    <div className="mt-0.5 text-[9px] text-gray-400">
                      {new Date(h.createdAt).toLocaleString("ar-MA")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Warehouse Receipts */}
      {item.warehouseReceipts.length > 0 && (
        <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-black">إيصالات المستودع</h2>
          <div className="space-y-2">
            {item.warehouseReceipts.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
              >
                <div>
                  <div className="font-mono text-xs font-black">
                    {r.receiptNumber}
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-500">
                    {new Date(r.receivedAt).toLocaleString("ar-MA")}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold">
                    كمية: {r.quantity}
                  </div>
                  <div
                    className={`text-[10px] font-bold ${
                      r.status === "VERIFIED"
                        ? "text-green-600"
                        : r.status === "DAMAGED"
                          ? "text-orange-600"
                          : r.status === "REJECTED"
                            ? "text-red-600"
                            : "text-gray-500"
                    }`}
                  >
                    {r.status === "VERIFIED"
                      ? "متحقق"
                      : r.status === "DAMAGED"
                        ? `تالف: ${r.damagedQuantity}`
                        : r.status === "REJECTED"
                          ? "مرفوض"
                          : "مستلم"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">
                {actionModal === "start_preparing"
                  ? "بدء التجهيز"
                  : "جاهز للجمع"}
              </h3>
              <button
                onClick={() => {
                  setActionModal(null);
                  setNote("");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-3 text-xs text-gray-600">
              {actionModal === "start_preparing"
                ? "هل بدأت بتجهيز هذا المنتج؟"
                : "هل المنتج جاهز للجمع من التاجر؟"}
            </p>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="ملاحظة (اختياري)..."
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
            />

            <div className="mt-4 flex gap-2">
              <button
                onClick={() =>
                  executeTransition(
                    actionModal === "start_preparing"
                      ? "PREPARING"
                      : "READY_FOR_COLLECTION",
                    note.trim() || undefined
                  )
                }
                disabled={submitting}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white disabled:opacity-50 ${
                  actionModal === "start_preparing"
                    ? "bg-blue-500 hover:bg-blue-600"
                    : "bg-purple-500 hover:bg-purple-600"
                }`}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                تأكيد
              </button>
              <button
                onClick={() => {
                  setActionModal(null);
                  setNote("");
                }}
                disabled={submitting}
                className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-bold text-gray-700"
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