"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  Clock,
  AlertCircle,
  Truck,
  Printer,
} from "lucide-react";

const CURRENCY = "د.م";

const FULFILLMENT_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "قيد الانتظار", cls: "bg-gray-100 text-gray-700" },
  PREPARING: { label: "قيد التجهيز", cls: "bg-amber-100 text-amber-700" },
  READY_FOR_COLLECTION: {
    label: "جاهز للجمع",
    cls: "bg-yellow-100 text-yellow-700",
  },
  COLLECTED: { label: "تم الجمع", cls: "bg-blue-100 text-blue-700" },
  IN_TRANSIT_TO_WAREHOUSE: {
    label: "في الطريق",
    cls: "bg-indigo-100 text-indigo-700",
  },
  RECEIVED: { label: "في المستودع", cls: "bg-teal-100 text-teal-700" },
  VERIFIED: { label: "تم الفحص", cls: "bg-green-100 text-green-700" },
  AVAILABLE_FOR_SHIPMENT: {
    label: "جاهز للشحن",
    cls: "bg-green-100 text-green-700",
  },
  ALLOCATED: { label: "مخصص", cls: "bg-emerald-100 text-emerald-700" },
  SHIPPED: { label: "تم الشحن", cls: "bg-purple-100 text-purple-700" },
  DELIVERED: { label: "تم التسليم", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "ملغى", cls: "bg-red-100 text-red-700" },
  RETURNED: { label: "مُرجع", cls: "bg-gray-100 text-gray-700" },
};

function statusLabel(status: string): string {
  return FULFILLMENT_LABELS[status]?.label || status;
}

export default function WarehouseOrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/warehouse/orders/${orderId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحميل");
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

  // ═══ فحص الطلبية ═══
  async function handleVerify() {
    setVerifying(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/warehouse/orders/${orderId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
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
      setVerifying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
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
            href="/warehouse/receipts"
            className="mt-6 inline-block rounded-full bg-teal-600 px-6 py-2.5 text-sm font-bold text-white"
          >
            العودة
          </Link>
        </div>
      </div>
    );
  }

  const address = order.shippingAddressSnapshot || {};
  const customer = order.customerSnapshot || {};
  const totalItems = order.items.reduce(
    (s: number, i: any) => s + i.quantity,
    0
  );

  // ═══ حالة الفحص ═══
  const allItems = order.items.flatMap((i: any) => i.fulfillmentItems || []);
  const allReceived = allItems.every((i: any) => i.status === "RECEIVED");
  const allVerified = allItems.every(
    (i: any) =>
      i.status === "VERIFIED" ||
      i.status === "AVAILABLE_FOR_SHIPMENT" ||
      i.status === "ALLOCATED" ||
      i.status === "SHIPPED" ||
      i.status === "DELIVERED"
  );

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/warehouse/receipts"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-teal-600"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للاستلامات
      </Link>

      {/* ═══ Header ═══ */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] text-gray-500">رقم الطلب</div>
            <div className="mt-0.5 font-mono text-xl font-black">
              {order.orderNumber}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
              <span>
                {new Date(order.createdAt).toLocaleDateString("ar-MA", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                {order.source === "IN_STORE" ? "محل" : "إلكتروني"}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full bg-teal-100 px-3 py-1 text-[11px] font-bold text-teal-700">
              {statusLabel(
                allItems[0]?.status || order.status
              )}
            </span>
            <span className="text-xs font-bold text-teal-700">
              {totalItems} منتج
            </span>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ═══ Seller ═══ */}
      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
          <Store className="h-4 w-4 text-teal-600" />
          التاجر
        </h2>
        <div className="space-y-1.5 text-sm">
          <div className="font-bold">{order.seller?.storeName || "—"}</div>
          {order.seller?.city && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="h-3 w-3" />
              {order.seller.city}
              {order.seller.region && ` — ${order.seller.region}`}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Customer ═══ */}
      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
          <User className="h-4 w-4 text-teal-600" />
          العميل
        </h2>
        <div className="space-y-2 text-sm">
          <div className="font-bold">
            {address.fullName || customer.name || order.user?.name || "—"}
          </div>
          {(address.phone || customer.phone || order.user?.phone) && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Phone className="h-3.5 w-3.5" />
              <span dir="ltr">
                {address.phone || customer.phone || order.user?.phone}
              </span>
            </div>
          )}
          {address.city && (
            <div className="flex items-start gap-1.5 text-xs text-gray-600">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {address.street && `${address.street}، `}
                {address.district && `${address.district}، `}
                {address.city}
                {address.postalCode && ` — ${address.postalCode}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ طلبات العميل الأخرى ═══ */}
      {order.customerOtherOrders && order.customerOtherOrders.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-indigo-900">
            <Package className="h-4 w-4" />
            طلبات العميل الأخرى ({order.customerOtherOrders.length})
          </h2>

          <div className="space-y-3">
            {order.customerOtherOrders.map((o: any) => {
              const statuses = (o.items || []).flatMap(
                (i: any) => i.fulfillmentItems || []
              );
              const allSame = statuses.every(
                (s: any) => s.status === statuses[0]?.status
              );
              const commonStatus = allSame ? statuses[0]?.status : "مختلط";
              const statusInfo =
                FULFILLMENT_LABELS[commonStatus] ||
                FULFILLMENT_LABELS.PENDING;

              return (
                <Link
                  key={o.id}
                  href={`/warehouse/orders/${o.id}`}
                  className="block rounded-xl border border-indigo-200 bg-white p-3 transition hover:border-indigo-400"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black">
                          {o.orderNumber}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            commonStatus === "مختلط"
                              ? "bg-gray-100 text-gray-700"
                              : statusInfo.cls
                          }`}
                        >
                          {commonStatus === "مختلط"
                            ? "مختلط"
                            : statusInfo.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {o.items.slice(0, 4).map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1 rounded bg-gray-50 px-1.5 py-0.5 text-[10px]"
                          >
                            {item.imageUrl && (
                              <img
                                src={item.imageUrl}
                                alt=""
                                className="h-4 w-4 rounded object-cover"
                              />
                            )}
                            <span className="max-w-[80px] truncate">
                              {item.productName}
                            </span>
                            <span className="font-bold">×{item.quantity}</span>
                          </div>
                        ))}
                        {o.items.length > 4 && (
                          <span className="text-[10px] text-gray-500">
                            +{o.items.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Products with big images ═══ */}
      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-black">
          <Package className="h-4 w-4 text-teal-600" />
          المنتجات ({order.items.length})
        </h2>

        <div className="space-y-4">
          {order.items.map((item: any) => {
            const fi = item.fulfillmentItems?.[0];
            const statusInfo =
              FULFILLMENT_LABELS[fi?.status] || FULFILLMENT_LABELS.PENDING;

            return (
              <div
                key={item.id}
                className="rounded-xl border border-gray-100 p-4"
              >
                <div className="flex gap-4">
                  {/* Image — bigger */}
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="h-24 w-24 shrink-0 rounded-lg object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                      <Package className="h-8 w-8 text-gray-400" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black">{item.productName}</div>
                    {item.variantName && (
                      <div className="mt-0.5 text-[11px] text-gray-500">
                        {item.variantName}
                      </div>
                    )}
                    {item.sku && (
                      <div className="mt-0.5 font-mono text-[10px] text-gray-400">
                        SKU: {item.sku}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">
                        الكمية: {item.quantity}
                      </span>
                      <span className="text-xs font-black text-gray-900">
                        {Number(item.total).toFixed(2)} {CURRENCY}
                      </span>
                    </div>
                  </div>
                </div>

                {fi && (
                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                    <span className="text-[10px] text-gray-500">
                      حالة التجهيز
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusInfo.cls}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ═══ Total ═══ */}
        <div className="mt-4 border-t border-dashed border-gray-200 pt-3">
          <div className="flex justify-between text-base font-black">
            <span>المجموع</span>
            <span className="text-teal-700">
              {Number(order.total).toFixed(2)} {CURRENCY}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ Actions ═══ */}
      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-black">إجراءات</h2>

        {/* زر الفحص */}
        {allReceived && !allVerified && (
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
          >
            {verifying ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
            تم فحص الطلبية — الحالة سليمة
          </button>
        )}

        {allVerified && (
          <div className="mb-3 rounded-xl border-2 border-green-200 bg-green-50 p-4 text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-green-600" />
            <div className="mt-2 text-sm font-black text-green-900">
              ✅ تم الفحص
            </div>
            <p className="mt-1 text-[11px] text-green-700">
              جاهز للتجميع في شحنة —{" "}
              <Link
                href="/warehouse/ready"
                className="font-bold underline"
              >
                اذهب إلى جاهز للشحن
              </Link>
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/d/${order.deliveryToken}`}
            className="flex items-center justify-center gap-2 rounded-lg border border-teal-600 bg-white py-2.5 text-xs font-bold text-teal-700 transition hover:bg-teal-50"
          >
            <Truck className="h-3.5 w-3.5" />
            عرض عبر QR
          </Link>
          <Link
            href={`/admin/orders/${order.id}`}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-2.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
          >
            <Printer className="h-3.5 w-3.5" />
            عرض إداري
          </Link>
        </div>
      </div>

      {/* ═══ Status History ═══ */}
      {order.statusHistory?.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-black">سجل الحالة</h2>
          <div className="space-y-2">
            {order.statusHistory.slice(0, 10).map((h: any) => (
              <div
                key={h.id}
                className="flex items-start gap-2 rounded-lg bg-gray-50 p-2.5"
              >
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold">
                    {h.fromStatus || "—"} → {h.toStatus}
                  </div>
                  {h.note && (
                    <div className="text-[10px] text-gray-500">{h.note}</div>
                  )}
                  <div className="mt-0.5 text-[9px] text-gray-400">
                    {new Date(h.createdAt).toLocaleString("ar-MA", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}