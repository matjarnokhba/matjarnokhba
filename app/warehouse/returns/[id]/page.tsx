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
  Store,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Truck,
  X,
  Check,
} from "lucide-react";

const CURRENCY = "د.م";

export default function WarehouseReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const returnId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Modals
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [inspectionStatus, setInspectionStatus] = useState<
    "INTACT" | "DAMAGED" | "INCOMPLETE"
  >("INTACT");
  const [inspectionNotes, setInspectionNotes] = useState("");

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);

  async function load() {
    try {
      const [returnRes, driversRes] = await Promise.all([
        fetch(`/api/returns/${returnId}/shipment`),
        fetch("/api/warehouse/drivers/available"),
      ]);

      const returnData = await returnRes.json();
      const driversData = await driversRes.json();

      if (!returnRes.ok || !returnData.success) {
        setError(returnData.message || "فشل التحميل");
        return;
      }

      setData(returnData.shipment);

      if (driversData.success) {
        setDrivers(driversData.drivers || []);
      }
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (returnId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnId]);

  async function handleInspect() {
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/warehouse/returns/${returnId}/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionStatus, inspectionNotes }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "فشل الفحص" });
        return;
      }

      setMessage({
        type: "success",
        text: `✅ تم تسجيل الفحص — ${inspectionLabel(inspectionStatus)}`,
      });
      setShowInspectModal(false);
      await load();
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssign() {
    if (!selectedDriver) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(
        `/api/warehouse/returns/${returnId}/assign-return-driver`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliveryPersonId: selectedDriver }),
        }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "فشل الإسناد" });
        return;
      }

      setMessage({
        type: "success",
        text: `✅ تم إسناد الإرجاع إلى ${data.driverName}`,
      });
      setShowAssignModal(false);
      setSelectedDriver(null);
      await load();
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-xl bg-red-50 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-3 text-lg font-black">{error}</h2>
          <Link
            href="/warehouse/returns"
            className="mt-6 inline-block rounded-full bg-teal-600 px-6 py-2.5 text-sm font-bold text-white"
          >
            العودة
          </Link>
        </div>
      </div>
    );
  }

  const ret = data.returnRequest;
  const order = ret.order;
  const customer = ret.user;
  const address = order.shippingAddressSnapshot || {};

  const canInspect =
    data.status === "IN_TRANSIT_TO_WAREHOUSE" ||
    data.status === "RECEIVED_AT_WAREHOUSE";
  const canAssign = data.status === "INSPECTED";
  const isCompleted = data.status === "COMPLETED";

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/warehouse/returns"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-teal-600"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للإرجاعات
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 p-5 text-white shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] opacity-90">رقم المرتجع</div>
            <div className="mt-1 font-mono text-lg font-black">
              {data.returnNumber}
            </div>
            <div className="mt-1 text-[11px] opacity-90">
              طلب: <span className="font-mono">{order.orderNumber}</span>
            </div>
          </div>
          <div className="rounded-xl bg-white/20 p-3">
            <Package className="h-6 w-6" />
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
          المنتجات المُرجعة ({ret.items.length})
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
                  <div className="mt-1 flex items-center gap-2">
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

      {/* Inspection status if done */}
      {data.status === "INSPECTED" || isCompleted ? (
        <div
          className={`mt-4 rounded-2xl border-2 p-5 ${
            data.inspectionStatus === "INTACT"
              ? "border-green-300 bg-green-50"
              : data.inspectionStatus === "DAMAGED"
                ? "border-red-300 bg-red-50"
                : "border-amber-300 bg-amber-50"
          }`}
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="text-sm font-black">
                حالة الفحص: {inspectionLabel(data.inspectionStatus)}
              </div>
              {data.inspectionNotes && (
                <div className="mt-1 text-xs">{data.inspectionNotes}</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Driver if assigned */}
      {data.returnDriver && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
            <Truck className="h-4 w-4 text-teal-600" />
            السائق المُسند
          </h2>
          <div className="text-sm font-bold">
            {data.returnDriver.user.name}
          </div>
          {data.returnDriver.user.phone && (
            <div className="mt-1 text-xs text-gray-500" dir="ltr">
              {data.returnDriver.user.phone}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {canInspect && (
        <button
          onClick={() => setShowInspectModal(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-4 text-sm font-bold text-white shadow-md transition hover:bg-amber-700"
        >
          <CheckCircle2 className="h-5 w-5" />
          فحص المرتجع
        </button>
      )}

      {canAssign && (
        <button
          onClick={() => setShowAssignModal(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-4 text-sm font-bold text-white shadow-md transition hover:bg-teal-700"
        >
          <Truck className="h-5 w-5" />
          إسناد سائق للإرجاع للتاجر
        </button>
      )}

      {isCompleted && (
        <div className="mt-4 rounded-2xl border-2 border-green-200 bg-green-50 p-5 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-green-600" />
          <div className="mt-2 text-sm font-black text-green-900">
            ✅ تم إكمال الإرجاع
          </div>
          <p className="mt-1 text-[11px] text-green-700">
            التاجر استلم المنتجات المُرجعة
          </p>
        </div>
      )}

      {/* ═══ Inspect Modal ═══ */}
      {showInspectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">فحص المرتجع</h3>
              <button
                onClick={() => setShowInspectModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-bold text-gray-700">
                حالة المنتجات
              </label>
              <div className="space-y-2">
                {[
                  {
                    key: "INTACT",
                    label: "سليم",
                    sub: "المنتجات في حالة جيدة",
                    color: "green",
                  },
                  {
                    key: "DAMAGED",
                    label: "متضرر",
                    sub: "المنتج تضرر أثناء الشحن/الاستخدام",
                    color: "red",
                  },
                  {
                    key: "INCOMPLETE",
                    label: "ناقص",
                    sub: "بعض القطع مفقودة",
                    color: "amber",
                  },
                ].map((opt) => {
                  const active = inspectionStatus === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setInspectionStatus(opt.key as any)}
                      className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-right transition ${
                        active
                          ? `border-${opt.color}-500 bg-${opt.color}-50`
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white ${
                          active
                            ? opt.color === "green"
                              ? "bg-green-500"
                              : opt.color === "red"
                                ? "bg-red-500"
                                : "bg-amber-500"
                            : "bg-gray-400"
                        }`}
                      >
                        {opt.key === "INTACT"
                          ? "✓"
                          : opt.key === "DAMAGED"
                            ? "!"
                            : "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold">{opt.label}</div>
                        <div className="text-[10px] text-gray-500">
                          {opt.sub}
                        </div>
                      </div>
                      {active && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-bold text-gray-700">
                ملاحظات (اختياري)
              </label>
              <textarea
                value={inspectionNotes}
                onChange={(e) => setInspectionNotes(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                placeholder="تفاصيل إضافية..."
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleInspect}
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                تأكيد الفحص
              </button>
              <button
                onClick={() => setShowInspectModal(false)}
                disabled={submitting}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Assign Driver Modal ═══ */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">إسناد سائق للإرجاع</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {drivers.length === 0 ? (
              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                ⚠️ لا يوجد سائقون متاحون
              </div>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {drivers.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDriver(d.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-right transition ${
                      selectedDriver === d.id
                        ? "border-teal-600 bg-teal-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white ${
                        selectedDriver === d.id ? "bg-teal-600" : "bg-gray-400"
                      }`}
                    >
                      {d.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">{d.name}</div>
                      <div className="text-[10px] text-gray-500">
                        📍 {d.city} · {d.activeShipments} شحنة نشطة
                      </div>
                    </div>
                    {selectedDriver === d.id && (
                      <Check className="h-4 w-4 text-teal-600" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleAssign}
                disabled={!selectedDriver || submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                تأكيد
              </button>
              <button
                onClick={() => setShowAssignModal(false)}
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

function inspectionLabel(status: string | null): string {
  if (!status) return "—";
  return (
    {
      INTACT: "سليم",
      DAMAGED: "متضرر",
      INCOMPLETE: "ناقص",
    }[status] || status
  );
}