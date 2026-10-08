"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Truck,
  Loader2,
  X,
  MapPin,
  Phone,
  Check,
  UserX,
} from "lucide-react";

type PersonOption = {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  vehicleType: string | null;
  activeOrders: number;
  sameCity: boolean;
};

type Props = {
  orderId: number;
  orderSource: string;
  orderStatus: string;
  currentDeliveryPersonId: number | null;
  currentDeliveryPersonName: string | null;
};

export default function AssignDeliveryButton({
  orderId,
  orderSource,
  orderStatus,
  currentDeliveryPersonId,
  currentDeliveryPersonName,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [persons, setPersons] = useState<PersonOption[]>([]);
  const [orderCity, setOrderCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ═══ إخفاء الزر لطلبات المحل والطلبات المكتملة ═══
  const isHidden =
    orderSource === "IN_STORE" ||
    orderStatus === "DELIVERED" ||
    orderStatus === "CANCELLED" ||
    orderStatus === "RETURNED";

  useEffect(() => {
    if (!open) return;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/orders/${orderId}/assign`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.message || "فشل التحميل");
          return;
        }
        setPersons(data.persons);
        setOrderCity(data.orderCity || "");
      } catch {
        setError("فشل الاتصال");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [open, orderId]);

  async function handleAssign(personId: number | null) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryPersonId: personId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل الإسناد");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("فشل الاتصال");
    } finally {
      setSaving(false);
    }
  }

  if (isHidden) return null;

  return (
    <>
      {/* ═══ الزر ═══ */}
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition ${
          currentDeliveryPersonId
            ? "border-2 border-green-500 bg-green-50 text-green-700 hover:bg-green-100"
            : "border-2 border-[#0a1f44] bg-white text-[#0a1f44] hover:bg-[#0a1f44]/5"
        }`}
      >
        <Truck className="h-3.5 w-3.5" />
        {currentDeliveryPersonId
          ? `السائق: ${currentDeliveryPersonName || "—"}`
          : "إسناد لسائق"}
      </button>

      {/* ═══ Modal ═══ */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black">إسناد الطلب لسائق</h3>
                {orderCity && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    مدينة التوصيل:{" "}
                    <strong className="text-[#0a1f44]">{orderCity}</strong>
                  </p>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ═══ خيار إلغاء الإسناد ═══ */}
            {currentDeliveryPersonId && (
              <button
                onClick={() => handleAssign(null)}
                disabled={saving}
                className="mb-3 flex w-full items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
              >
                <UserX className="h-4 w-4" />
                إلغاء الإسناد الحالي
              </button>
            )}

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-[#ff5c00]" />
              </div>
            ) : persons.length === 0 ? (
              <div className="rounded-lg bg-amber-50 p-6 text-center text-xs text-amber-800">
                لا يوجد أصحاب توصيل نشطون.
                <br />
                أضف سائقاً أولاً من{" "}
                <strong>/admin/delivery-persons</strong>
              </div>
            ) : (
              <div className="space-y-2">
                {persons.map((p) => {
                  const isCurrent = p.id === currentDeliveryPersonId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleAssign(p.id)}
                      disabled={saving}
                      className={`flex w-full items-center gap-3 rounded-lg border-2 p-3 text-right transition disabled:opacity-50 ${
                        isCurrent
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 bg-white hover:border-[#ff5c00]"
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0a1f44] to-purple-600 text-sm font-black text-white">
                        {p.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-black text-gray-900">
                            {p.name}
                          </span>
                          {p.sameCity && (
                            <span className="rounded-full bg-[#ff5c00] px-1.5 py-0.5 text-[9px] font-bold text-white">
                              نفس المدينة
                            </span>
                          )}
                          {isCurrent && (
                            <span className="flex items-center gap-1 rounded-full bg-green-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                              <Check className="h-2.5 w-2.5" />
                              مُعيّن
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500">
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />
                            {p.city}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Phone className="h-2.5 w-2.5" />
                            <span dir="ltr">{p.phone}</span>
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-gray-500">
                          طلبات نشطة: <strong>{p.activeOrders}</strong>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}