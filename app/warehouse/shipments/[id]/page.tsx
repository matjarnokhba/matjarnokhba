"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Truck,
  User,
  Phone,
  MapPin,
  Package,
  Check,
  X,
  AlertCircle,
  QrCode,
  Printer,
} from "lucide-react";

const CURRENCY = "د.م";

export default function ShipmentDetailPage() {
  const params = useParams();
  const shipmentId = params.id as string;

  const [shipment, setShipment] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);

  // Cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function load() {
    try {
      const [shipmentRes, driversRes] = await Promise.all([
        fetch(`/api/warehouse/shipments/${shipmentId}`),
        fetch("/api/warehouse/drivers/available"),
      ]);

      const shipmentData = await shipmentRes.json();
      const driversData = await driversRes.json();

      if (!shipmentRes.ok || !shipmentData.success) {
        setError(shipmentData.message || "الشحنة غير موجودة");
        return;
      }

      setShipment(shipmentData.shipment);

      if (driversData.success) {
        setDrivers(driversData.drivers || []);
      }
    } catch {
      setError("فشل التحميل");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (shipmentId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  async function handleCancel() {
    setCancelling(true);
    setMessage(null);

    try {
      const res = await fetch(
        `/api/warehouse/shipments/${shipmentId}/cancel`,
        { method: "POST" }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({
          type: "error",
          text: data.message || "فشل الإلغاء",
        });
        return;
      }

      setShowCancelModal(false);
      setMessage({
        type: "success",
        text: `✅ تم إلغاء الشحنة — ${data.itemsRestored} عنصر عاد للإسناد`,
      });

      setTimeout(() => {
        window.location.href = "/warehouse/shipments";
      }, 1200);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setCancelling(false);
    }
  }

  async function handleAssign() {
    if (!selectedDriver) return;
    setAssigning(true);
    setMessage(null);

    try {
      const res = await fetch(
        `/api/warehouse/shipments/${shipmentId}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliveryPersonId: selectedDriver }),
        }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({
          type: "error",
          text: data.message || "فشل الإسناد",
        });
        return;
      }

      setMessage({
        type: "success",
        text: `✅ تم إسناد الشحنة إلى ${data.driverName}`,
      });
      setShowAssignModal(false);
      setSelectedDriver(null);
      await load();

      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
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
            href="/warehouse/shipments"
            className="mt-6 inline-block rounded-full bg-teal-600 px-6 py-2.5 text-sm font-bold text-white"
          >
            العودة
          </Link>
        </div>
      </div>
    );
  }

  const canAssign = !shipment.deliveryPerson && shipment.status === "READY";

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/warehouse/shipments"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-teal-600"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للشحنات
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 p-5 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] opacity-90">رقم الشحنة</div>
            <div className="mt-1 font-mono text-xl font-black">
              {shipment.shipmentNumber}
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
            <Truck className="h-6 w-6" />
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

      {/* Counters */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white p-4 text-center shadow-sm">
          <div className="text-2xl font-black text-teal-700">
            {shipment.totalOrders}
          </div>
          <div className="mt-1 text-[10px] text-gray-500">طلب</div>
        </div>
        <div className="rounded-xl bg-white p-4 text-center shadow-sm">
          <div className="text-2xl font-black text-teal-700">
            {shipment.itemsCount}
          </div>
          <div className="mt-1 text-[10px] text-gray-500">عنصر</div>
        </div>
        <div className="rounded-xl bg-white p-4 text-center shadow-sm">
          <div className="text-lg font-black text-teal-700">
            {Number(shipment.totalCOD).toFixed(0)}
          </div>
          <div className="mt-1 text-[10px] text-gray-500">{CURRENCY}</div>
        </div>
      </div>

      {/* Address */}
      {shipment.city && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
            <MapPin className="h-4 w-4 text-teal-600" />
            عنوان التوصيل
          </h2>
          <div className="space-y-2 text-sm">
            {shipment.customer && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <span className="font-bold">{shipment.customer.name}</span>
              </div>
            )}
            {shipment.customer?.phone && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Phone className="h-3.5 w-3.5" />
                <span dir="ltr">{shipment.customer.phone}</span>
              </div>
            )}
            <div className="flex items-start gap-2 text-xs text-gray-600">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {shipment.city}
                {shipment.district && ` — ${shipment.district}`}
                {shipment.street && ` — ${shipment.street}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Products */}
      {shipment.items?.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
            <Package className="h-4 w-4 text-teal-600" />
            المنتجات ({shipment.items.length})
          </h2>
          <div className="space-y-2">
            {shipment.items.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg bg-gray-50 p-2.5"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.productName}
                    className="h-11 w-11 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-gray-200">
                    <Package className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-xs font-bold">
                    {item.productName}
                  </div>
                  {item.variantName && (
                    <div className="text-[10px] text-gray-500">
                      {item.variantName}
                    </div>
                  )}
                  <div className="mt-0.5 text-[10px] text-gray-500">
                    طلب: <span className="font-mono">{item.orderNumber}</span>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-xs font-black text-teal-700">
                    ×{item.quantity}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {Number(item.total).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Driver */}
      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
          <Truck className="h-4 w-4 text-teal-600" />
          السائق
        </h2>

        {shipment.deliveryPerson ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-sm font-black text-green-700">
                {shipment.deliveryPerson.name.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-bold">
                  {shipment.deliveryPerson.name}
                </div>
                {shipment.deliveryPerson.phone && (
                  <div className="text-[11px] text-gray-500" dir="ltr">
                    {shipment.deliveryPerson.phone}
                  </div>
                )}
              </div>
            </div>
            {shipment.assignedAt && (
              <div className="text-[10px] text-gray-400">
                أُسندت في:{" "}
                {new Date(shipment.assignedAt).toLocaleString("ar-MA", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">
            <AlertCircle className="h-4 w-4" />
            لم يُسند بعد
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {/* ═══ زر طباعة الملصق ═══ */}
        <Link
          href={`/warehouse/shipments/${shipmentId}/label`}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#0a1f44] py-3.5 text-sm font-bold text-white transition hover:bg-[#1a2f54]"
        >
          <Printer className="h-4 w-4" />
          طباعة الملصق
        </Link>

        {canAssign && (
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-3.5 text-sm font-bold text-white transition hover:bg-teal-700"
          >
            <Truck className="h-4 w-4" />
            إسناد سائق
          </button>
        )}

        <Link
          href={`/warehouse`}
          className="flex items-center justify-center gap-2 rounded-xl border border-teal-600 bg-white py-3.5 text-sm font-bold text-teal-700 transition hover:bg-teal-50"
        >
          <QrCode className="h-4 w-4" />
          لوحة المستودع
        </Link>

        {/* ═══ زر الإلغاء — فقط قبل الإسناد ═══ */}
        {shipment.status === "READY" && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-red-500 bg-red-50 py-3.5 text-sm font-bold text-red-700 transition hover:bg-red-100 sm:col-span-2"
          >
            <X className="h-4 w-4" />
            إلغاء الشحنة
          </button>
        )}
      </div>

      {/* ═══ Cancel Modal ═══ */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <X className="h-7 w-7 text-red-600" />
            </div>
            <h3 className="mt-4 text-center text-lg font-black">
              تأكيد إلغاء الشحنة
            </h3>
            <p className="mt-2 text-center text-sm text-gray-600">
              سيتم إلغاء الشحنة{" "}
              <strong className="font-mono">{shipment.shipmentNumber}</strong>
              {" "}وإرجاع كل العناصر إلى قائمة "جاهز للشحن".
            </p>
            <p className="mt-2 text-center text-[11px] text-gray-500">
              يمكن التراجع فقط قبل إسناد الشحنة لسائق.
            </p>

            <div className="mt-6 flex gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                تأكيد الإلغاء
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700"
              >
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">إسناد سائق</h3>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedDriver(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {drivers.length === 0 ? (
              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                ⚠️ لا يوجد سائقون. أنشئ سائقًا من /admin/users/new
              </div>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {drivers.map((d) => {
                  const selected = selectedDriver === d.id;
                  const servesCity =
                    shipment.city &&
                    (d.city === shipment.city ||
                      d.cities?.includes(shipment.city));

                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDriver(d.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-right transition ${
                        selected
                          ? "border-teal-600 bg-teal-50"
                          : servesCity
                            ? "border-green-300 bg-green-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white ${
                          selected
                            ? "bg-teal-600"
                            : servesCity
                              ? "bg-green-500"
                              : "bg-gray-400"
                        }`}
                      >
                        {d.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{d.name}</span>
                          {servesCity && (
                            <span className="rounded-full bg-green-200 px-1.5 py-0.5 text-[9px] font-bold text-green-800">
                              مناسب
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          📍 {d.city}
                          {d.cities?.length > 1 && ` +${d.cities.length - 1}`}
                          {" · "}
                          {d.activeShipments} شحنة نشطة
                        </div>
                      </div>
                      {selected && <Check className="h-4 w-4 text-teal-600" />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleAssign}
                disabled={!selectedDriver || assigning}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                {assigning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                تأكيد
              </button>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedDriver(null);
                }}
                disabled={assigning}
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