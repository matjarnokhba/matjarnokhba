"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Package,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Store,
  User,
  Phone,
  MapPin,
  X,
  Warehouse,
} from "lucide-react";

type Item = {
  id: number;
  status: string;
  quantity: number;
  deadline: string | null;
  preparedAt: string | null;
  readyAt: string | null;
  collectedAt: string | null;
  departedAt: string | null;
  warehouseReceivedAt: string | null;
  verifiedAt: string | null;
  notes: string | null;
  createdAt: string;
  seller: {
    id: number;
    storeName: string;
    slug: string;
    city: string | null;
    region: string | null;
  };
  order: {
    id: number;
    orderNumber: string;
    source: string;
    status: string;
    userId: number;
    createdAt: string;
    customerSnapshot: any;
    shippingAddressSnapshot: any;
  };
  orderItem: {
    id: number;
    productName: string;
    variantName: string | null;
    sku: string;
    imageUrl: string | null;
    quantity: number;
    unitPrice: number;
    total: number;
  };
  history: {
    id: number;
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    createdAt: string;
  }[];
  receipts: {
    id: number;
    receiptNumber: string;
    quantity: number;
    status: string;
    receivedAt: string;
    verifiedAt: string | null;
    damagedQuantity: number;
    rejectionReason: string | null;
    notes: string | null;
  }[];
  collection: {
    assignmentId: number;
    assignmentNumber: string;
    collectedAt: string | null;
  } | null;
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  IN_TRANSIT_TO_WAREHOUSE: {
    label: "في الطريق للمستودع",
    cls: "bg-indigo-100 text-indigo-700",
  },
  RECEIVED: { label: "مستلم", cls: "bg-cyan-100 text-cyan-700" },
  VERIFIED: { label: "متحقق", cls: "bg-teal-100 text-teal-700" },
  AVAILABLE_FOR_SHIPMENT: {
    label: "متاح للشحن",
    cls: "bg-green-100 text-green-700",
  },
  RETURNED: { label: "مُرجع", cls: "bg-red-100 text-red-700" },
};

type ActionModal =
  | { type: "receive"; quantity: number; notes: string }
  | { type: "verify"; damagedQuantity: number; notes: string }
  | { type: "reject"; reason: string; notes: string }
  | { type: "mark_available" }
  | null;

export default function AdminWarehouseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [modal, setModal] = useState<ActionModal>(null);
  const [modalError, setModalError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/warehouse/${itemId}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "العنصر غير موجود");
        return;
      }
      setItem(data.item);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (itemId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function executeAction(
    action: string,
    payload: Record<string, any> = {}
  ) {
    setSubmitting(true);
    setModalError("");

    try {
      const res = await fetch(`/api/admin/warehouse/${itemId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setModalError(data.message || "فشل التنفيذ");
        return;
      }

      setSuccessMsg(data.message || "تم بنجاح");
      setModal(null);
      await load();

      setTimeout(() => setSuccessMsg(""), 3000);
    } catch {
      setModalError("فشل الاتصال");
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
            href="/admin/warehouse"
            className="mt-6 inline-block rounded-full bg-[#ff5c00] px-6 py-2.5 text-sm font-bold text-white"
          >
            عودة للمستودع
          </Link>
        </div>
      </div>
    );
  }

  if (!item) return null;

  const info = STATUS_LABELS[item.status] || STATUS_LABELS.RECEIVED;
  const isOnline = item.order.source === "ONLINE";
  const address = item.order.shippingAddressSnapshot || {};
  const customer = item.order.customerSnapshot || {};

  const canReceive = item.status === "IN_TRANSIT_TO_WAREHOUSE";
  const canVerify = item.status === "RECEIVED";
  const canMarkAvailable = item.status === "VERIFIED";

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/admin/warehouse"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للمستودع
      </Link>

      {/* Header */}
      <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-gray-500">إيصال العنصر</div>
            <div className="mt-1 font-mono text-xl font-black">
              #{item.id}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {new Date(item.createdAt).toLocaleString("ar-MA")}
            </div>
          </div>
          <span
            className={`rounded-full px-4 py-2 text-xs font-bold ${info.cls}`}
          >
            {info.label}
          </span>
        </div>

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
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
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
                  {item.orderItem.unitPrice.toFixed(2)} د.م
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seller + Order */}
      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
            <Store className="h-4 w-4 text-[#ff5c00]" />
            التاجر
          </h2>
          <div className="space-y-1.5 text-sm">
            <div className="font-black">{item.seller.storeName}</div>
            {item.seller.city && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <MapPin className="h-3.5 w-3.5" />
                {item.seller.city}
                {item.seller.region && ` · ${item.seller.region}`}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
            <Package className="h-4 w-4 text-[#ff5c00]" />
            الطلب
          </h2>
          <div className="space-y-1.5 text-sm">
            <div className="font-mono font-black">
              {item.order.orderNumber}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              {isOnline ? (
                <>
                  <span>🌐</span>
                  <span>طلب إلكتروني</span>
                </>
              ) : (
                <>
                  <span>🏪</span>
                  <span>طلب محل</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customer (للمعلومات) */}
      {isOnline && address.fullName && (
        <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-black">
            <User className="h-4 w-4 text-[#ff5c00]" />
            العميل
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
            {address.city && (
              <div className="flex items-start gap-2 text-xs text-gray-600">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {address.street}، {address.city}
                  {address.postalCode && ` - ${address.postalCode}`}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {(canReceive || canVerify || canMarkAvailable) && (
        <div className="mb-5 space-y-2">
          {canReceive && (
            <button
              onClick={() =>
                setModal({
                  type: "receive",
                  quantity: item.quantity,
                  notes: "",
                })
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 py-4 text-sm font-bold text-white shadow-md transition hover:opacity-95"
            >
              <Warehouse className="h-5 w-5" />
              استلام في المستودع
            </button>
          )}

          {canVerify && (
            <>
              <button
                onClick={() =>
                  setModal({
                    type: "verify",
                    damagedQuantity: 0,
                    notes: "",
                  })
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 py-4 text-sm font-bold text-white shadow-md transition hover:opacity-95"
              >
                <CheckCircle2 className="h-5 w-5" />
                تأكيد التحقق
              </button>
              <button
                onClick={() =>
                  setModal({ type: "reject", reason: "", notes: "" })
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-500 bg-red-50 py-3.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
              >
                <AlertTriangle className="h-5 w-5" />
                رفض العنصر
              </button>
            </>
          )}

          {canMarkAvailable && (
            <button
              onClick={() => setModal({ type: "mark_available" })}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 py-4 text-sm font-bold text-white shadow-md transition hover:opacity-95"
            >
              <CheckCircle2 className="h-5 w-5" />
              متاح للشحن
            </button>
          )}
        </div>
      )}

      {/* Receipts */}
      {item.receipts.length > 0 && (
        <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-black">
            <Warehouse className="h-4 w-4 text-[#ff5c00]" />
            إيصالات الاستلام ({item.receipts.length})
          </h2>
          <div className="space-y-2">
            {item.receipts.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-gray-100 p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs font-black">
                    {r.receiptNumber}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      r.status === "VERIFIED"
                        ? "bg-green-100 text-green-700"
                        : r.status === "DAMAGED"
                          ? "bg-orange-100 text-orange-700"
                          : r.status === "REJECTED"
                            ? "bg-red-100 text-red-700"
                            : "bg-cyan-100 text-cyan-700"
                    }`}
                  >
                    {r.status === "VERIFIED"
                      ? "متحقق"
                      : r.status === "DAMAGED"
                        ? "تالف"
                        : r.status === "REJECTED"
                          ? "مرفوض"
                          : "مستلم"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-gray-500">
                  <span>الكمية: {r.quantity}</span>
                  {r.damagedQuantity > 0 && (
                    <span className="text-orange-600">
                      تالف: {r.damagedQuantity}
                    </span>
                  )}
                  <span>
                    {new Date(r.receivedAt).toLocaleString("ar-MA")}
                  </span>
                </div>
                {r.rejectionReason && (
                  <div className="mt-1 text-[10px] text-red-600">
                    سبب الرفض: {r.rejectionReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
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
              const hInfo =
                STATUS_LABELS[h.toStatus] || STATUS_LABELS.RECEIVED;
              return (
                <div key={h.id} className="flex gap-3">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${hInfo.cls}`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold">{hInfo.label}</div>
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

      {/* Modals */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">
                {modal.type === "receive"
                  ? "استلام في المستودع"
                  : modal.type === "verify"
                    ? "تأكيد التحقق"
                    : modal.type === "reject"
                      ? "رفض العنصر"
                      : "تعيين كمتاح للشحن"}
              </h3>
              <button
                onClick={() => {
                  setModal(null);
                  setModalError("");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modal.type === "receive" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    الكمية المستلمة
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={item.quantity}
                    value={modal.quantity}
                    onChange={(e) =>
                      setModal({
                        ...modal,
                        quantity: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]"
                  />
                  <div className="mt-1 text-[10px] text-gray-500">
                    الحد الأقصى: {item.quantity}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    ملاحظات
                  </label>
                  <textarea
                    value={modal.notes}
                    onChange={(e) =>
                      setModal({ ...modal, notes: e.target.value })
                    }
                    rows={2}
                    className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#ff5c00]"
                  />
                </div>
              </div>
            )}

            {modal.type === "verify" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    عدد الوحدات التالفة (اختياري)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={item.quantity}
                    value={modal.damagedQuantity}
                    onChange={(e) =>
                      setModal({
                        ...modal,
                        damagedQuantity: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]"
                  />
                  <div className="mt-1 text-[10px] text-gray-500">
                    اتركه 0 إذا كان العنصر سليماً
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    ملاحظات
                  </label>
                  <textarea
                    value={modal.notes}
                    onChange={(e) =>
                      setModal({ ...modal, notes: e.target.value })
                    }
                    rows={2}
                    className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#ff5c00]"
                  />
                </div>
              </div>
            )}

            {modal.type === "reject" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    سبب الرفض *
                  </label>
                  <textarea
                    value={modal.reason}
                    onChange={(e) =>
                      setModal({ ...modal, reason: e.target.value })
                    }
                    rows={3}
                    placeholder="مثال: العنصر تالف، أو ليس مطابقاً للوصف..."
                    className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    ملاحظات إضافية
                  </label>
                  <textarea
                    value={modal.notes}
                    onChange={(e) =>
                      setModal({ ...modal, notes: e.target.value })
                    }
                    rows={2}
                    className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#ff5c00]"
                  />
                </div>
              </div>
            )}

            {modal.type === "mark_available" && (
              <p className="mb-4 text-sm text-gray-600">
                هل تريد تعيين هذا العنصر كمتاح للشحن؟
              </p>
            )}

            {modalError && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {modalError}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  if (modal.type === "receive") {
                    executeAction("receive", {
                      quantity: modal.quantity,
                      notes: modal.notes || undefined,
                    });
                  } else if (modal.type === "verify") {
                    executeAction("verify", {
                      damagedQuantity: modal.damagedQuantity,
                      notes: modal.notes || undefined,
                    });
                  } else if (modal.type === "reject") {
                    if (modal.reason.trim().length < 3) {
                      setModalError("سبب الرفض مطلوب (3 أحرف على الأقل)");
                      return;
                    }
                    executeAction("reject", {
                      reason: modal.reason,
                      notes: modal.notes || undefined,
                    });
                  } else {
                    executeAction("mark_available");
                  }
                }}
                disabled={submitting}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white disabled:opacity-50 ${
                  modal.type === "receive"
                    ? "bg-cyan-500 hover:bg-cyan-600"
                    : modal.type === "verify"
                      ? "bg-teal-500 hover:bg-teal-600"
                      : modal.type === "reject"
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-green-500 hover:bg-green-600"
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
                  setModal(null);
                  setModalError("");
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