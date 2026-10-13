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
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  Send,
  Store,
  X,
} from "lucide-react";

const CURRENCY = "د.م";

export default function AssemblyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assemblyId = params.id as string;

  const [assembly, setAssembly] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/warehouse/assembly/${assemblyId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحميل");
        return;
      }
      setAssembly(data.assembly);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (assemblyId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assemblyId]);

  async function handleCreateShipment() {
    setCreating(true);
    setMessage(null);

    try {
      const res = await fetch(
        `/api/warehouse/assembly/${assemblyId}/create-shipment`,
        { method: "POST" }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "فشل الإنشاء" });
        return;
      }

      setMessage({
        type: "success",
        text: `✅ تم إنشاء الشحنة ${data.shipmentNumber}`,
      });
      setShowConfirm(false);

      setTimeout(() => {
        router.push(`/warehouse/shipments/${data.shipmentId}`);
      }, 1200);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
      </div>
    );
  }

  if (error || !assembly) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-xl bg-red-50 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-3 text-lg font-black">{error}</h2>
          <Link
            href="/warehouse/assembly"
            className="mt-6 inline-block rounded-full bg-teal-600 px-6 py-2.5 text-sm font-bold text-white"
          >
            العودة
          </Link>
        </div>
      </div>
    );
  }

  const address = assembly.order?.shippingAddressSnapshot || {};
  const customer = assembly.order?.customerSnapshot || {};

  const receivedItems = assembly.items.filter((i: any) => i.receivedAt);
  const missingItems = assembly.items.filter((i: any) => !i.receivedAt);

  const isReady = assembly.status === "READY";
  const isPartial = assembly.status === "PARTIALLY_SHIPPED";
  const isCompleted = assembly.status === "COMPLETED";

  const progress = assembly.expectedItems
    ? Math.round((assembly.receivedItems / assembly.expectedItems) * 100)
    : 0;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/warehouse/assembly"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-teal-600"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للتجميع
      </Link>

      {/* Header */}
      <div
        className={`rounded-2xl p-5 text-white shadow-md ${
          isReady
            ? "bg-gradient-to-br from-green-600 to-green-800"
            : "bg-gradient-to-br from-teal-600 to-teal-800"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] opacity-90">رقم التجميع</div>
            <div className="mt-1 font-mono text-lg font-black">
              {assembly.assemblyCode}
            </div>
            <div className="mt-1 text-[11px] opacity-90">
              طلب: <span className="font-mono">{assembly.order.orderNumber}</span>
            </div>
          </div>
          <div className="rounded-xl bg-white/20 p-3">
            <Package className="h-6 w-6" />
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px]">
            <span>
              {assembly.receivedItems} / {assembly.expectedItems} منتج
            </span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full bg-white transition-all"
              style={{ width: `${progress}%` }}
            />
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

      {/* Customer */}
      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
          <User className="h-4 w-4 text-teal-600" />
          العميل
        </h2>
        <div className="space-y-2 text-sm">
          <div className="font-bold">
            {address.fullName || customer.name || assembly.user.name}
          </div>
          {(address.phone || customer.phone || assembly.user.phone) && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Phone className="h-3.5 w-3.5" />
              <span dir="ltr">
                {address.phone || customer.phone || assembly.user.phone}
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
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Customer other orders */}
      {assembly.customerOtherOrders?.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-indigo-900">
            <Package className="h-4 w-4" />
            طلبات العميل الأخرى ({assembly.customerOtherOrders.length})
          </h2>

          <div className="space-y-2">
            {assembly.customerOtherOrders.map((o: any) => (
              <Link
                key={o.id}
                href={
                  o.assemblyFile
                    ? `/warehouse/assembly/${o.assemblyFile.id}`
                    : `/warehouse/orders/${o.id}`
                }
                className="block rounded-xl border border-indigo-200 bg-white p-3 transition hover:border-indigo-400"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black">
                        {o.orderNumber}
                      </span>
                      {o.assemblyFile && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            o.assemblyFile.status === "READY"
                              ? "bg-green-100 text-green-700"
                              : o.assemblyFile.status === "PENDING"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {o.assemblyFile.receivedItems}/
                          {o.assemblyFile.expectedItems}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Received items */}
      {receivedItems.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            منتجات وصلت ({receivedItems.length})
          </h2>
          <div className="space-y-2">
            {receivedItems.map((ai: any) => {
              const oi = ai.fulfillmentItem.orderItem;
              return (
                <div
                  key={ai.id}
                  className="flex gap-3 rounded-xl border border-green-100 bg-green-50/30 p-3"
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
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-teal-700">
                        ×{ai.expectedQuantity}
                      </span>
                      {ai.includedInShipment && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          🚚 في شحنة
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Missing items */}
      {missingItems.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-amber-900">
            <Clock className="h-4 w-4" />
            منتجات لم تصل بعد ({missingItems.length})
          </h2>
          <div className="space-y-2">
            {missingItems.map((ai: any) => {
              const oi = ai.fulfillmentItem.orderItem;
              const seller = ai.fulfillmentItem.seller;
              const status = ai.fulfillmentItem.status;

              return (
                <div
                  key={ai.id}
                  className="flex gap-3 rounded-xl border border-amber-200 bg-white p-3"
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
                    {seller && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-600">
                        <Store className="h-3 w-3" />
                        {seller.storeName}
                        {seller.city && ` — ${seller.city}`}
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        ×{ai.expectedQuantity}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        الحالة: {statusLabel(status)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action */}
      {isReady && !isCompleted && (
        <div className="mt-4">
          <button
            onClick={() => setShowConfirm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-4 text-sm font-bold text-white shadow-md transition hover:bg-teal-700"
          >
            <Send className="h-5 w-5" />
            إنشاء شحنة ({receivedItems.length} عنصر)
          </button>
        </div>
      )}

      {isCompleted && (
        <div className="mt-4 rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-blue-600" />
          <div className="mt-2 text-sm font-black text-blue-900">
            ✅ تم إنشاء الشحنة
          </div>
          <p className="mt-1 text-[11px] text-blue-700">
            الشحنة موجودة في قائمة الشحنات
          </p>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">تأكيد إنشاء الشحنة</h3>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-teal-50 p-4 text-center">
              <div className="text-2xl font-black text-teal-900">
                {receivedItems.length}
              </div>
              <div className="mt-1 text-[11px] text-teal-700">
                منتج جاهز للشحن
              </div>
            </div>

            <p className="mb-4 text-center text-sm text-gray-600">
              سيتم إنشاء شحنة واحدة تحتوي على كل المنتجات.
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleCreateShipment}
                disabled={creating}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                تأكيد
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={creating}
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

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: "قيد الانتظار",
    PREPARING: "قيد التجهيز",
    READY_FOR_COLLECTION: "جاهز للجمع",
    COLLECTED: "تم الجمع",
    IN_TRANSIT_TO_WAREHOUSE: "في الطريق",
    RECEIVED: "في المستودع",
    VERIFIED: "تم الفحص",
    AVAILABLE_FOR_SHIPMENT: "جاهز للشحن",
    ALLOCATED: "مخصص",
    SHIPPED: "تم الشحن",
    DELIVERED: "تم التسليم",
    CANCELLED: "ملغى",
    RETURNED: "مُرجع",
  };
  return map[status] || status;
}