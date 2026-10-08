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
  Truck,
  Check,
  Clock,
  XCircle,
  RotateCcw,
  AlertCircle,
  X,
} from "lucide-react";

type ShipmentItem = {
  id: number;
  productName: string;
  variantName: string | null;
  imageUrl: string | null;
  quantity: number;
};

type OrderGroup = {
  orderId: number;
  orderNumber: string;
  customerSnapshot: any;
  shippingAddressSnapshot: any;
  items: ShipmentItem[];
};

type Shipment = {
  id: number;
  shipmentNumber: string;
  status: string;
  totalCOD: number;
  totalOrders: number;
  notes: string | null;
  customer: {
    id: number;
    name: string;
    phone: string | null;
    email: string;
  } | null;
  orders: OrderGroup[];
};

type ActionModal = "delivered" | "postponed" | "refused" | "returned" | null;

export default function DeliveryShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const shipmentId = params.id as string;

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [actionModal, setActionModal] = useState<ActionModal>(null);
  const [reason, setReason] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/shipments/${shipmentId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "الشحنة غير موجودة");
        return;
      }
      setShipment(data.shipment);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (shipmentId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  async function executeAction(action: string, actionReason?: string) {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/delivery/shipments/${shipmentId}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            ...(actionReason && { reason: actionReason }),
          }),
        }
      );
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
        router.push("/delivery/shipments");
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

  if (error || !shipment) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-xl bg-red-50 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-3 text-lg font-black">{error}</h2>
          <Link
            href="/delivery/shipments"
            className="mt-6 inline-block rounded-full bg-green-500 px-6 py-2.5 text-sm font-bold text-white"
          >
            عودة للشحنات
          </Link>
        </div>
      </div>
    );
  }

  const canAct = ["ASSIGNED", "IN_TRANSIT"].includes(shipment.status);
  const firstOrder = shipment.orders[0];
  const address = firstOrder?.shippingAddressSnapshot || {};

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/delivery/shipments"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-green-600"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للشحنات
      </Link>

      {/* Header */}
      <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-gray-500">رقم الشحنة</div>
            <div className="mt-1 font-mono text-xl font-black">
              {shipment.shipmentNumber}
            </div>
          </div>
          <div className="rounded-full bg-purple-100 px-4 py-2 text-xs font-bold text-purple-700">
            {shipment.status === "ASSIGNED"
              ? "مُسندة"
              : shipment.status === "IN_TRANSIT"
                ? "مع السائق"
                : shipment.status}
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          <Check className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Customer */}
      {shipment.customer && (
        <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
            <User className="h-4 w-4 text-green-600" />
            العميل
          </h2>
          <div className="space-y-2 text-sm">
            <div className="font-bold">
              {address.fullName || shipment.customer.name}
            </div>
            {(address.phone || shipment.customer.phone) && (
              <a
                href={`tel:${address.phone || shipment.customer.phone}`}
                className="flex items-center gap-2 text-xs text-green-600 hover:underline"
              >
                <Phone className="h-3.5 w-3.5" />
                <span dir="ltr">
                  {address.phone || shipment.customer.phone}
                </span>
              </a>
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

      {/* COD */}
      <div className="mb-4 rounded-2xl bg-gradient-to-l from-green-500 to-emerald-600 p-5 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs opacity-90">المبلغ المطلوب تحصيله</div>
            <div className="mt-1 text-3xl font-black">
              {shipment.totalCOD.toFixed(2)} د.م
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-90">الطلبات</div>
            <div className="text-2xl font-black">{shipment.totalOrders}</div>
          </div>
        </div>
      </div>

      {/* Orders + Items */}
      <div className="space-y-4">
        {shipment.orders.map((group) => (
          <div
            key={group.orderId}
            className="rounded-2xl bg-white p-5 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div className="font-mono text-sm font-black text-green-600">
                {group.orderNumber}
              </div>
              <div className="text-[10px] text-gray-500">
                {group.items.length} عنصر
              </div>
            </div>

            <div className="space-y-2">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-b border-gray-50 pb-2 last:border-0 last:pb-0"
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
                  <div className="shrink-0 text-xs font-black">
                    ×{item.quantity}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      {canAct && (
        <div className="mt-5 space-y-2">
          <button
            onClick={() => setActionModal("delivered")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 py-4 text-sm font-bold text-white shadow-md"
          >
            <Check className="h-5 w-5" />
            تم تسليم الشحنة
          </button>
          <button
            onClick={() => setActionModal("postponed")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-500 bg-amber-50 py-3.5 text-sm font-bold text-amber-700"
          >
            <Clock className="h-5 w-5" />
            تأجيل
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActionModal("refused")}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-red-500 bg-red-50 py-3.5 text-sm font-bold text-red-700"
            >
              <XCircle className="h-5 w-5" />
              رفض العميل
            </button>
            <button
              onClick={() => setActionModal("returned")}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-gray-400 bg-gray-50 py-3.5 text-sm font-bold text-gray-700"
            >
              <RotateCcw className="h-5 w-5" />
              إرجاع
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            {actionModal === "delivered" ? (
              <>
                <div className="mb-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="mt-4 text-lg font-black">تأكيد التسليم</h3>
                  <p className="mt-2 text-xs text-gray-600">
                    هل تم تسليم الشحنة كاملة واستلام المبلغ (
                    {shipment.totalCOD.toFixed(2)} د.م)؟
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
                    {actionModal === "postponed"
                      ? "تأجيل التوصيل"
                      : actionModal === "refused"
                        ? "رفض العميل"
                        : "إرجاع الشحنة"}
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
                    onClick={() => executeAction(actionModal, reason)}
                    disabled={submitting || reason.trim().length < 3}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white disabled:opacity-50 ${
                      actionModal === "postponed"
                        ? "bg-amber-500"
                        : actionModal === "refused"
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