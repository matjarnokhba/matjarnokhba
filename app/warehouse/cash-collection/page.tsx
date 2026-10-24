"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Truck,
  CheckCircle2,
  X,
  AlertTriangle,
  PackageX,
  ArrowLeft,
} from "lucide-react";
import QRCode from "qrcode";

type DriverCash = {
  id: number;
  name: string;
  phone: string | null;
  cashInHand: number;
  pendingRefusedCount: number;
};

export default function WarehouseCashCollectionPage() {
  const [drivers, setDrivers] = useState<DriverCash[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDriver, setSelectedDriver] = useState<DriverCash | null>(null);
  const [actualAmount, setActualAmount] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [handoverInfo, setHandoverInfo] = useState<{
    expected: number;
    actual: number;
    shortfall: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadDrivers() {
    try {
      const res = await fetch("/api/warehouse/drivers/cash/pending");
      const data = await res.json();
      if (data.success) {
        setDrivers(data.drivers.filter((d: DriverCash) => d.cashInHand > 0));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDrivers();
  }, []);

  function openModal(driver: DriverCash) {
    if (driver.pendingRefusedCount > 0) {
      setError(
        `لدى ${driver.name} ${driver.pendingRefusedCount} منتج مرفوض لم يُرجع للمستودع. يرجى استلام المرتجعات أولاً.`
      );
      return;
    }
    setSelectedDriver(driver);
    setActualAmount(driver.cashInHand.toString());
    setQrImage("");
    setHandoverInfo(null);
    setError("");
  }

  async function handleCreateHandover() {
    if (!selectedDriver || !actualAmount) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/warehouse/cash-handover/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: selectedDriver.id,
          actualAmount: Number(actualAmount),
        }),
      });
      const data = await res.json();
      if (data.success) {
        const url = await QRCode.toDataURL(data.qrToken, {
          width: 400,
          margin: 1,
        });
        setQrImage(url);
        setHandoverInfo({
          expected: data.expectedAmount,
          actual: data.actualAmount,
          shortfall: data.shortfall,
        });
      } else {
        setError(data.message || "حدث خطأ");
      }
    } catch (e) {
      setError("فشل الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-teal-600" />
      </div>
    );

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Truck className="h-6 w-6 text-teal-600" />
          تحصيل الكاش من السائقين
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          سجل المبلغ الذي استلمته من كل سائق، ثم دع السائق يمسح QR للتأكيد
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 font-bold">{error}</p>
            <Link
              href="/warehouse/returns-in-transit"
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:underline"
            >
              <ArrowLeft className="h-3 w-3" />
              اذهب لاستلام المرتجعات أولاً
            </Link>
          </div>
          <button onClick={() => setError("")} className="p-1">
            <X className="h-4 w-4 text-red-500" />
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {drivers.map((driver) => {
          const hasRefused = driver.pendingRefusedCount > 0;
          return (
            <div
              key={driver.id}
              className={`rounded-xl bg-white p-5 shadow-sm border-2 ${
                hasRefused ? "border-amber-300" : "border-gray-100"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 font-black text-lg">
                  {driver.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-gray-900">{driver.name}</div>
                  <div className="text-xs text-gray-500" dir="ltr">
                    {driver.phone}
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-red-50 p-3 mb-3 flex justify-between items-center border border-red-100">
                <span className="text-xs font-bold text-red-700">
                  الكاش في حوزته:
                </span>
                <span className="text-lg font-black text-red-600">
                  {driver.cashInHand.toFixed(2)} د.م
                </span>
              </div>

              {hasRefused && (
                <div className="rounded-lg bg-amber-50 p-2.5 mb-3 border border-amber-300 flex items-center gap-2">
                  <PackageX className="h-4 w-4 text-amber-600 shrink-0" />
                  <div className="flex-1">
                    <div className="text-[11px] font-bold text-amber-800">
                      {driver.pendingRefusedCount} منتج مرفوض لم يُرجع
                    </div>
                  </div>
                </div>
              )}

              {hasRefused ? (
                <Link
                  href="/warehouse/returns-in-transit"
                  className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-bold text-white transition hover:bg-amber-700 flex items-center justify-center gap-2"
                >
                  <PackageX className="h-4 w-4" />
                  استلام المرتجعات أولاً
                </Link>
              ) : (
                <button
                  onClick={() => openModal(driver)}
                  className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700"
                >
                  استلام الكاش
                </button>
              )}
            </div>
          );
        })}
        {drivers.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-3" />
            <p className="font-bold text-lg">كل الحسابات مصفاة</p>
            <p className="text-sm">لا يوجد كاش في ذمة السائقين حالياً.</p>
          </div>
        )}
      </div>

      {selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black">
                استلام كاش من {selectedDriver.name}
              </h2>
              <button
                onClick={() => setSelectedDriver(null)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {!qrImage ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 p-3 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-600">
                    المبلغ المتوقع:
                  </span>
                  <span className="text-lg font-black text-gray-900">
                    {selectedDriver.cashInHand.toFixed(2)} د.م
                  </span>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    المبلغ المستلم فعلياً (د.م)
                  </label>
                  <input
                    type="number"
                    value={actualAmount}
                    onChange={(e) => setActualAmount(e.target.value)}
                    min="0"
                    max={selectedDriver.cashInHand}
                    step="0.01"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-lg font-bold outline-none focus:border-teal-500"
                  />
                </div>

                {Number(actualAmount) < selectedDriver.cashInHand &&
                  Number(actualAmount) >= 0 && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">
                          يوجد نقص بقيمة{" "}
                          {(
                            selectedDriver.cashInHand - Number(actualAmount)
                          ).toFixed(2)}{" "}
                          د.م
                        </p>
                        <p className="mt-1">
                          سيتم خصم هذا المبلغ من استحقاقات السائق.
                        </p>
                      </div>
                    </div>
                  )}

                {error && (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleCreateHandover}
                  disabled={
                    submitting || !actualAmount || Number(actualAmount) < 0
                  }
                  className="w-full rounded-lg bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-700 flex justify-center disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "تأكيد وتوليد QR للتسليم"
                  )}
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="bg-teal-50 text-teal-700 p-3 rounded-lg text-xs font-bold mb-4">
                  الرجاء مطالبة السائق بمسح هذا الرمز.
                </div>
                <div className="mx-auto w-64 h-64 bg-white p-2 rounded-xl border-2 border-teal-600">
                  <img
                    src={qrImage}
                    alt="QR"
                    className="w-full h-full object-contain"
                  />
                </div>
                {handoverInfo && handoverInfo.shortfall > 0 && (
                  <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 font-bold border border-red-200">
                    ⚠️ تنبيه: عجز {handoverInfo.shortfall.toFixed(2)} د.م سيُخصم
                    من السائق.
                  </div>
                )}
                <button
                  onClick={() => {
                    setSelectedDriver(null);
                    setQrImage("");
                    loadDrivers();
                  }}
                  className="mt-6 w-full rounded-lg border-2 border-gray-200 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
                >
                  إغلاق وتحديث القائمة
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}