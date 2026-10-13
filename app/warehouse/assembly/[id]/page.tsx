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
  AlertTriangle,
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
  const [showConfirm, setShowConfirm] = useState<"full" | "partial" | null>(
    null
  );
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

  async function handleCreateShipment(allowPartial: boolean) {
    setCreating(true);
    setMessage(null);

    try {
      const res = await fetch(
        `/api/warehouse/assembly/${assemblyId}/create-shipment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ allowPartial }),
        }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "فشل الإنشاء" });
        return;
      }

      setMessage({
        type: "success",
        text: data.isPartial
          ? `✅ تم إنشاء شحنة جزئية ${data.shipmentNumber} (${data.itemsCount} منتج) — بانتظار ${data.waitingItems} منتج`
          : `✅ تم إنشاء الشحنة ${data.shipmentNumber}`,
      });
      setShowConfirm(null);

      setTimeout(() => {
        router.push(`/warehouse/shipments/${data.shipmentId}`);
      }, 1500);
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

  // ═══ تصنيف العناصر — `includedInShipment` على AssemblyItem ═══
  const shippableNow = (assembly.items as any[]).filter(
    (i: any) =>
      !i.includedInShipment &&
      (i.fulfillmentItem.status === "VERIFIED" ||
        i.fulfillmentItem.status === "AVAILABLE_FOR_SHIPMENT")
  );

  const alreadyShipped = (assembly.items as any[]).filter(
    (i: any) => i.includedInShipment
  );

  const waiting = (assembly.items as any[]).filter(
    (i: any) => !i.includedInShipment && !i.receivedAt
  );

  const isReady = assembly.status === "READY";
  const isPartial = assembly.status === "PARTIALLY_SHIPPED";
  const isCompleted = assembly.status === "COMPLETED";
  const isPending = assembly.status === "PENDING";

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

      {/* ═══ Header ═══ */}
      <div
        className={`rounded-2xl p-5 text-white shadow-md ${
          isCompleted
            ? "bg-gradient-to-br from-blue-600 to-blue-800"
            : isPartial
              ? "bg-gradient-to-br from-orange-600 to-orange-800"
              : isReady
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
              طلب:{" "}
              <span className="font-mono">{assembly.order.orderNumber}</span>
            </div>
          </div>
          <div className="rounded-xl bg-white/20 p-3">
            <Package className="h-6 w-6" />
          </div>
        </div>

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

      {/* ═══ Customer ═══ */}
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

      {/* ═══ Waiting items ═══ */}
      {waiting.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-amber-900">
            <Clock className="h-4 w-4" />
            منتجات لم تصل بعد ({waiting.length})
          </h2>
          <div className="space-y-2">
            {waiting.map((ai: any) => {
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
                        {statusLabel(status)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Shippable now ═══ */}
      {shippableNow.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-green-200 bg-green-50 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-green-900">
            <CheckCircle2 className="h-4 w-4" />
            جاهز للشحن الآن ({shippableNow.length})
          </h2>
          <div className="space-y-2">
            {shippableNow.map((ai: any) => {
              const oi = ai.fulfillmentItem.orderItem;
              return (
                <div
                  key={ai.id}
                  className="flex gap-3 rounded-xl border border-green-200 bg-white p-3"
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
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                        ×{ai.expectedQuantity}
                      </span>
                      <span className="text-[10px] font-black text-teal-700">
                        {Number(oi.total).toFixed(2)} {CURRENCY}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Already shipped ═══ */}
      {alreadyShipped.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-blue-700">
            <Truck className="h-4 w-4" />
            تم شحنها سابقًا ({alreadyShipped.length})
          </h2>
          <div className="space-y-2">
            {alreadyShipped.map((ai: any) => {
              const oi = ai.fulfillmentItem.orderItem;
              return (
                <div
                  key={ai.id}
                  className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3"
                >
                  {oi.imageUrl ? (
                    <img
                      src={oi.imageUrl}
                      alt={oi.productName}
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                      <Package className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold">{oi.productName}</div>
                    <div className="mt-1 text-[10px] text-gray-500">
                      ×{ai.expectedQuantity} ·{" "}
                      {statusLabel(ai.fulfillmentItem.status)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Shipments created ═══ */}
      {assembly.shipments?.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
            <Truck className="h-4 w-4 text-teal-600" />
            الشحنات المنشأة ({assembly.shipments.length})
          </h2>
          <div className="space-y-2">
            {assembly.shipments.map((s: any) => (
              <Link
                key={s.id}
                href={`/warehouse/shipments/${s.id}`}
                className="block rounded-lg border border-gray-100 p-3 transition hover:border-teal-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black">
                        {s.shipmentNumber}
                      </span>
                      <ShipmentStatusBadge status={s.status} />
                    </div>
                    <div className="mt-1 text-[10px] text-gray-500">
                      {s._count.items} منتج ·{" "}
                      {Number(s.totalCOD).toFixed(2)} {CURRENCY}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Customer other orders ═══ */}
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

      {/* ═══ Actions ═══ */}
      {!isCompleted && shippableNow.length > 0 && (
        <div className="mt-4 space-y-2">
          {isReady && (
            <button
              onClick={() => setShowConfirm("full")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-4 text-sm font-bold text-white shadow-md transition hover:bg-green-700"
            >
              <Send className="h-5 w-5" />
              إنشاء شحنة كاملة ({shippableNow.length} منتج)
            </button>
          )}

          {(isPending || isPartial) && (
            <button
              onClick={() => setShowConfirm("partial")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-4 text-sm font-bold text-white shadow-md transition hover:bg-orange-700"
            >
              <AlertTriangle className="h-5 w-5" />
              شحن الجزء المتوفر ({shippableNow.length} منتج)
            </button>
          )}
        </div>
      )}

      {isCompleted && (
        <div className="mt-4 rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-blue-600" />
          <div className="mt-2 text-sm font-black text-blue-900">
            ✅ تم شحن كل المنتجات
          </div>
          <p className="mt-1 text-[11px] text-blue-700">
            لا توجد منتجات متبقية
          </p>
        </div>
      )}

      {/* ═══ Confirm Modal ═══ */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">
                {showConfirm === "full"
                  ? "تأكيد إنشاء الشحنة"
                  : "تأكيد الشحن الجزئي"}
              </h3>
              <button
                onClick={() => setShowConfirm(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {showConfirm === "partial" && (
              <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <div className="text-sm font-black text-amber-900">
                      تنبيه — شحن جزئي
                    </div>
                    <p className="mt-1 text-xs text-amber-800">
                      سيتم شحن <strong>{shippableNow.length}</strong> منتج فقط،
                      وسيبقى{" "}
                      <strong className="text-orange-700">
                        {waiting.length} منتج
                      </strong>{" "}
                      في ملف التجميع بانتظار وصوله.
                    </p>
                    <p className="mt-2 text-[11px] text-amber-700">
                      سيتم إشعار العميل بأنه سيستلم طلبه على دفعات.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-teal-50 p-3">
                <div className="text-2xl font-black text-teal-900">
                  {shippableNow.length}
                </div>
                <div className="mt-1 text-[10px] text-teal-700">
                  سيتم شحنه
                </div>
              </div>
              {showConfirm === "partial" && (
                <div className="rounded-xl bg-orange-50 p-3">
                  <div className="text-2xl font-black text-orange-900">
                    {waiting.length}
                  </div>
                  <div className="mt-1 text-[10px] text-orange-700">
                    سينتظر
                  </div>
                </div>
              )}
              {showConfirm === "full" && (
                <div className="rounded-xl bg-green-50 p-3">
                  <div className="text-2xl font-black text-green-900">
                    {assembly.expectedItems}
                  </div>
                  <div className="mt-1 text-[10px] text-green-700">
                    إجمالي الطلب
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleCreateShipment(showConfirm === "partial")}
                disabled={creating}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white transition disabled:opacity-50 ${
                  showConfirm === "full"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-orange-600 hover:bg-orange-700"
                }`}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                تأكيد
              </button>
              <button
                onClick={() => setShowConfirm(null)}
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

function ShipmentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    READY: { label: "جاهزة", cls: "bg-blue-100 text-blue-700" },
    ASSIGNED: { label: "مُسندة", cls: "bg-indigo-100 text-indigo-700" },
    PICKED_UP: { label: "استُلمت", cls: "bg-purple-100 text-purple-700" },
    OUT_FOR_DELIVERY: {
      label: "قيد التوصيل",
      cls: "bg-orange-100 text-orange-700",
    },
    DELIVERED: { label: "تم التسليم", cls: "bg-green-100 text-green-700" },
    CANCELLED: { label: "ملغاة", cls: "bg-red-100 text-red-700" },
  };
  const info = map[status] || {
    label: status,
    cls: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${info.cls}`}
    >
      {info.label}
    </span>
  );
}