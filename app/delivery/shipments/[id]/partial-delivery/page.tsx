"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Package,
  Calculator,
  Minus,
  Plus,
  Ban,
} from "lucide-react";

type ShipmentItemDecision = {
  shipmentItemId: number;
  productName: string;
  variantName: string | null;
  imageUrl: string | null;
  originalQuantity: number;
  acceptedQuantity: number;
  reason: string;
  codAmount: number;
};

type OrderGroup = {
  orderId: number;
  orderNumber: string;
  total: number;
  items: ShipmentItemDecision[];
};

type Shipment = {
  id: number;
  shipmentNumber: string;
  status: string;
  totalCOD: number;
  totalOrders: number;
  customer: { name: string; phone: string | null } | null;
  orders: Array<{
    orderId: number;
    orderNumber: string;
    total: number;
    items: Array<{
      shipmentItemId: number;
      productName: string;
      variantName: string | null;
      imageUrl: string | null;
      quantity: number;
      codAmount: number;
    }>;
  }>;
};

export default function PartialDeliveryPage() {
  const params = useParams();
  const router = useRouter();
  const shipmentId = params.id as string;

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [groups, setGroups] = useState<OrderGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/delivery/shipments/${shipmentId}`);
        const data = await res.json();
        if (!data.success) {
          setError(data.message || "فشل التحميل");
          return;
        }
        setShipment(data.shipment);

        const initialGroups: OrderGroup[] = data.shipment.orders.map(
          (o: any) => ({
            orderId: o.orderId,
            orderNumber: o.orderNumber,
            total: o.total,
            items: o.items.map((i: any) => ({
              shipmentItemId: i.shipmentItemId,
              productName: i.productName,
              variantName: i.variantName,
              imageUrl: i.imageUrl,
              originalQuantity: i.quantity,
              acceptedQuantity: i.quantity,
              reason: "",
              codAmount: i.codAmount,
            })),
          })
        );
        setGroups(initialGroups);
      } catch {
        setError("فشل الاتصال");
      } finally {
        setLoading(false);
      }
    }
    if (shipmentId) load();
  }, [shipmentId]);

  function updateAccepted(
    orderId: number,
    shipmentItemId: number,
    delta: number
  ) {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.orderId !== orderId) return g;
        return {
          ...g,
          items: g.items.map((i) => {
            if (i.shipmentItemId !== shipmentItemId) return i;
            const newVal = Math.max(
              0,
              Math.min(i.originalQuantity, i.acceptedQuantity + delta)
            );
            return { ...i, acceptedQuantity: newVal };
          }),
        };
      })
    );
  }

  function setAccepted(
    orderId: number,
    shipmentItemId: number,
    value: number
  ) {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.orderId !== orderId) return g;
        return {
          ...g,
          items: g.items.map((i) => {
            if (i.shipmentItemId !== shipmentItemId) return i;
            const newVal = Math.max(
              0,
              Math.min(i.originalQuantity, isNaN(value) ? 0 : value)
            );
            return { ...i, acceptedQuantity: newVal };
          }),
        };
      })
    );
  }

  function setReason(orderId: number, shipmentItemId: number, reason: string) {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.orderId !== orderId) return g;
        return {
          ...g,
          items: g.items.map((i) =>
            i.shipmentItemId === shipmentItemId ? { ...i, reason } : i
          ),
        };
      })
    );
  }

  function acceptAll() {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((i) => ({
          ...i,
          acceptedQuantity: i.originalQuantity,
          reason: "",
        })),
      }))
    );
  }

  function refuseAll() {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((i) => ({
          ...i,
          acceptedQuantity: 0,
          reason: i.reason || "رفض كامل من الزبون",
        })),
      }))
    );
  }

  // ═══ الحسابات ═══
  const allItems = groups.flatMap((g) => g.items);
  const hasAnyRefusal = allItems.some(
    (i) => i.acceptedQuantity < i.originalQuantity
  );
  const hasMissingReasons = allItems.some(
    (i) =>
      i.acceptedQuantity < i.originalQuantity && i.reason.trim().length < 3
  );

  let calculatedCOD = 0;
  let totalRefused = 0;
  let totalAccepted = 0;

  for (const group of groups) {
    let orderAcceptedSubtotal = 0;
    let orderHasAccepted = false;

    for (const item of group.items) {
      const acceptedAmount =
        (item.codAmount / item.originalQuantity) * item.acceptedQuantity;
      orderAcceptedSubtotal += acceptedAmount;
      totalAccepted += item.acceptedQuantity;
      totalRefused += item.originalQuantity - item.acceptedQuantity;
      if (item.acceptedQuantity > 0) orderHasAccepted = true;
    }

    // الشحن يُحسب فقط إذا قُبل شيء من الأوردر
    const shipping = orderHasAccepted
      ? Number((shipment as any)?.orders?.find((o: any) => o.orderId === group.orderId)?.shippingCost || 0)
      : 0;

    calculatedCOD += orderAcceptedSubtotal + shipping;
  }

  const canSubmit = !hasMissingReasons;

  async function handleSubmit() {
    if (hasMissingReasons) {
      setError("يجب كتابة سبب رفض لكل منتج تم رفض جزء منه (3 أحرف على الأقل)");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const decisions = allItems.map((i) => ({
        shipmentItemId: i.shipmentItemId,
        refusedQuantity: i.originalQuantity - i.acceptedQuantity,
        ...(i.acceptedQuantity < i.originalQuantity && {
          reason: i.reason.trim(),
        }),
      }));

      const res = await fetch(
        `/api/delivery/shipments/${shipmentId}/partial-delivery`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decisions }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل التسليم");
        return;
      }

      router.push(`/delivery/shipments`);
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
    <div className="p-4 pt-16 pb-32 lg:p-8 lg:pt-8 min-h-screen bg-gray-50" dir="rtl">
      <div className="mx-auto max-w-2xl space-y-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-gray-900"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع للشحنة
        </button>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="text-xl font-black">
            تسليم الشحنة {shipment.shipmentNumber}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            حدد الكمية المقبولة لكل منتج. الكمية المتبقية تُعتبر مرفوضة (يجب
            كتابة السبب).
          </p>

          <div className="mt-4 flex gap-2">
            <button
              onClick={acceptAll}
              className="flex-1 rounded-lg border-2 border-green-500 bg-green-50 py-2 text-xs font-bold text-green-700 hover:bg-green-100"
            >
              <CheckCircle2 className="inline h-4 w-4 mr-1" />
              قبول الكل
            </button>
            <button
              onClick={refuseAll}
              className="flex-1 rounded-lg border-2 border-red-500 bg-red-50 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
            >
              <Ban className="inline h-4 w-4 mr-1" />
              رفض الكل
            </button>
          </div>
        </div>

        {groups.map((group) => (
          <div key={group.orderId} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div className="font-mono text-sm font-black text-green-600">
                {group.orderNumber}
              </div>
              <div className="text-[11px] text-gray-500">
                {group.items.length} منتج
              </div>
            </div>

            <div className="space-y-3">
              {group.items.map((item) => {
                const refused = item.originalQuantity - item.acceptedQuantity;
                const isFullyAccepted = refused === 0;
                const isFullyRefused = item.acceptedQuantity === 0;

                return (
                  <div
                    key={item.shipmentItemId}
                    className={`rounded-xl border-2 p-3 transition ${
                      isFullyAccepted
                        ? "border-green-200 bg-green-50/50"
                        : isFullyRefused
                          ? "border-red-200 bg-red-50/50"
                          : "border-amber-200 bg-amber-50/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          className="h-14 w-14 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-200">
                          <Package className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold">
                          {item.productName}
                        </div>
                        {item.variantName && (
                          <div className="text-[11px] text-gray-500">
                            {item.variantName}
                          </div>
                        )}
                        <div className="mt-1 text-[11px] text-gray-600">
                          الكمية المطلوبة: <strong>{item.originalQuantity}</strong>
                        </div>
                      </div>
                    </div>

                    {/* محدد الكمية المقبولة */}
                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 border border-gray-200">
                      <div className="flex-1 min-w-[150px]">
                        <label className="mb-1 block text-[10px] font-bold text-gray-600">
                          الكمية المقبولة
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateAccepted(group.orderId, item.shipmentItemId, -1)
                            }
                            disabled={item.acceptedQuantity <= 0}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-30"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <input
                            type="number"
                            value={item.acceptedQuantity}
                            onChange={(e) =>
                              setAccepted(
                                group.orderId,
                                item.shipmentItemId,
                                Number(e.target.value)
                              )
                            }
                            min={0}
                            max={item.originalQuantity}
                            className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm font-bold outline-none focus:border-green-500"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateAccepted(group.orderId, item.shipmentItemId, 1)
                            }
                            disabled={
                              item.acceptedQuantity >= item.originalQuantity
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-30"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-[10px] font-bold text-gray-600">
                          مرفوض
                        </div>
                        <div
                          className={`text-lg font-black ${
                            refused > 0 ? "text-red-600" : "text-gray-400"
                          }`}
                        >
                          {refused}
                        </div>
                      </div>
                    </div>

                    {/* سبب الرفض */}
                    {refused > 0 && (
                      <div className="mt-2">
                        <label className="mb-1 block text-[10px] font-bold text-red-700">
                          سبب رفض الـ {refused} منتج <span>*</span>
                        </label>
                        <input
                          type="text"
                          value={item.reason}
                          onChange={(e) =>
                            setReason(
                              group.orderId,
                              item.shipmentItemId,
                              e.target.value
                            )
                          }
                          placeholder="مثال: المنتج تالف"
                          className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500"
                        />
                        {item.reason.trim().length > 0 &&
                          item.reason.trim().length < 3 && (
                            <div className="mt-1 text-[10px] text-red-600">
                              السبب قصير جداً (3 أحرف على الأقل)
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* ملخص */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
            <Calculator className="h-4 w-4 text-[#ff5c00]" />
            ملخص التسليم
          </h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">إجمالي الكميات:</span>
              <span className="font-bold">
                {allItems.reduce((s, i) => s + i.originalQuantity, 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">مقبول:</span>
              <span className="font-bold text-green-600">{totalAccepted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">مرفوض:</span>
              <span className="font-bold text-red-600">{totalRefused}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-gray-600">المبلغ المطلوب تحصيله:</span>
              <span className="text-lg font-black text-[#ff5c00]">
                {calculatedCOD.toFixed(2)} د.م
              </span>
            </div>
          </div>

          {!hasAnyRefusal && (
            <div className="mt-3 rounded-lg bg-green-50 p-3 text-xs text-green-800 border border-green-200">
              ✅ كل المنتجات مقبولة — سيتم تسجيل تسليم كامل.
            </div>
          )}
          {hasAnyRefusal &&
            totalAccepted === 0 && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200">
                ⚠️ رفض كامل — سيتم إرجاع كل المنتجات للمستودع، ولن يتم تحصيل أي مبلغ.
              </div>
            )}
          {hasAnyRefusal &&
            totalAccepted > 0 &&
            totalRefused > 0 && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
                ℹ️ تسليم جزئي — سيتم تحصيل مبلغ المنتجات المقبولة + الشحن.
              </div>
            )}
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
          ) : totalAccepted === 0 ? (
            "تأكيد الرفض الكامل والإرجاع"
          ) : hasAnyRefusal ? (
            "تأكيد التسليم الجزئي"
          ) : (
            "تأكيد التسليم الكامل"
          )}
        </button>
      </div>
    </div>
  );
}