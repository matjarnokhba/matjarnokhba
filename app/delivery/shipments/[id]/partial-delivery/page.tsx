"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, AlertCircle, ArrowRight, Package, Calculator } from "lucide-react";

type ShipmentOrder = {
  orderId: number;
  orderNumber: string;
  items: Array<{
    id: number;
    productName: string;
    variantName: string | null;
    imageUrl: string | null;
    quantity: number;
  }>;
};

type Shipment = {
  id: number;
  shipmentNumber: string;
  status: string;
  totalCOD: number;
  totalOrders: number;
  customer: { name: string; phone: string | null } | null;
  orders: ShipmentOrder[];
};

type OrderChoice = {
  orderId: number;
  orderNumber: string;
  accepted: boolean;
  reason: string;
};

export default function PartialDeliveryPage() {
  const params = useParams();
  const router = useRouter();
  const shipmentId = params.id as string;

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [choices, setChoices] = useState<OrderChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/delivery/shipments/${shipmentId}`);
        const data = await res.json();
        if (data.success) {
          setShipment(data.shipment);
          setChoices(
            data.shipment.orders.map((o: ShipmentOrder) => ({
              orderId: o.orderId,
              orderNumber: o.orderNumber,
              accepted: true,
              reason: "",
            }))
          );
        } else {
          setError(data.message || "فشل التحميل");
        }
      } catch {
        setError("فشل الاتصال");
      } finally {
        setLoading(false);
      }
    }
    if (shipmentId) load();
  }, [shipmentId]);

  function toggleAccept(orderId: number) {
    setChoices((prev) =>
      prev.map((c) =>
        c.orderId === orderId
          ? { ...c, accepted: !c.accepted, reason: c.accepted ? "" : c.reason }
          : c
      )
    );
  }

  function setReason(orderId: number, reason: string) {
    setChoices((prev) =>
      prev.map((c) => (c.orderId === orderId ? { ...c, reason } : c))
    );
  }

  const acceptedChoices = choices.filter((c) => c.accepted);
  const refusedChoices = choices.filter((c) => !c.accepted);
  const allRefused = acceptedChoices.length === 0;
  const allAccepted = refusedChoices.length === 0;

  const canSubmit = refusedChoices.every((c) => c.reason.trim().length >= 3);

  async function handleSubmit() {
    if (!canSubmit) {
      setError("يجب كتابة سبب رفض لكل طلبية مرفوضة (3 أحرف على الأقل)");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/delivery/shipments/${shipmentId}/partial-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptedOrderIds: acceptedChoices.map((c) => c.orderId),
          refusedOrders: refusedChoices.map((c) => ({
            orderId: c.orderId,
            reason: c.reason.trim(),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل التسليم");
        return;
      }

      router.push(`/delivery/shipments/${shipmentId}`);
      router.refresh();
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

  if (error && !shipment) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-xl bg-red-50 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-3 text-lg font-black">{error}</h2>
        </div>
      </div>
    );
  }

  if (!shipment) return null;

  return (
    <div className="p-4 pt-16 pb-24 lg:p-8 lg:pt-8 min-h-screen bg-gray-50" dir="rtl">
      <div className="mx-auto max-w-2xl space-y-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-gray-900"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع للشحنة
        </button>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="text-xl font-black">تسليم جزئي - الشحنة {shipment.shipmentNumber}</h1>
          <p className="mt-1 text-sm text-gray-600">
            حدد لكل طلبية: هل قبلها الزبون أم رفضها؟
          </p>
        </div>

        <div className="space-y-3">
          {shipment.orders.map((order) => {
            const choice = choices.find((c) => c.orderId === order.orderId)!;
            return (
              <div
                key={order.orderId}
                className={`rounded-2xl p-4 shadow-sm border-2 transition ${
                  choice.accepted
                    ? "bg-green-50 border-green-300"
                    : "bg-red-50 border-red-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="font-mono font-black text-sm">{order.orderNumber}</div>
                  <button
                    onClick={() => toggleAccept(order.orderId)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      choice.accepted
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-red-600 text-white hover:bg-red-700"
                    }`}
                  >
                    {choice.accepted ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        مقبولة
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5" />
                        مرفوضة
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-xs">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-200">
                          <Package className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                      <span className="flex-1 truncate">{item.productName}</span>
                      <span className="font-bold">×{item.quantity}</span>
                    </div>
                  ))}
                </div>

                {!choice.accepted && (
                  <div className="mt-3">
                    <label className="block text-[11px] font-bold text-red-800 mb-1">
                      سبب الرفض <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={choice.reason}
                      onChange={(e) => setReason(order.orderId, e.target.value)}
                      placeholder="مثال: المنتج تالف، السعر مرتفع، إلخ"
                      className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
            <Calculator className="h-4 w-4 text-[#ff5c00]" />
            ملخص التسليم
          </h2>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">الطلبات المقبولة:</span>
              <span className="font-bold text-green-600">{acceptedChoices.length} / {shipment.orders.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">الطلبات المرفوضة:</span>
              <span className="font-bold text-red-600">{refusedChoices.length}</span>
            </div>
            
            {allRefused && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200">
                ⚠️ رفض كامل: لن يتم تحصيل أي مبلغ من الزبون. سيتم إرجاع كل البضاعة للمستودع، ولن تأخذ أجر التوصيل.
              </div>
            )}
            
            {!allRefused && !allAccepted && (
              <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-800 border border-blue-200">
                ℹ️ تسليم جزئي: سيتم تحصيل مبلغ الطلبات المقبولة + رسوم الشحن.
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className="w-full rounded-xl bg-green-600 py-4 text-base font-black text-white shadow-lg transition hover:bg-green-700 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          ) : allRefused ? (
            "تأكيد الرفض الكامل والإرجاع"
          ) : allAccepted ? (
            "تأكيد التسليم الكامل"
          ) : (
            "تأكيد التسليم الجزئي"
          )}
        </button>
      </div>
    </div>
  );
}