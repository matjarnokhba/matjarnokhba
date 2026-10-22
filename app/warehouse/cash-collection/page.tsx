"use client";

import { useEffect, useState } from "react";
import { Loader2, Truck, CheckCircle2, QrCode, X } from "lucide-react";
import QRCode from "qrcode";

type DriverCash = {
  id: number;
  name: string;
  phone: string | null;
  pendingCash: number;
};

export default function WarehouseCashCollectionPage() {
  const [drivers, setDrivers] = useState<DriverCash[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [selectedDriver, setSelectedDriver] = useState<DriverCash | null>(null);
  const [expectedAmount, setExpectedAmount] = useState(0);
  const [actualAmount, setActualAmount] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadDrivers() {
    try {
      const res = await fetch("/api/warehouse/drivers/cash/pending");
      const data = await res.json();
      if (data.success) {
        setDrivers(data.drivers.filter((d: DriverCash) => d.pendingCash !== 0));
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

  async function handleCreateHandover() {
    if (!selectedDriver) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/warehouse/cash-handover/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: selectedDriver.id,
          expectedAmount: expectedAmount,
          actualAmount: Number(actualAmount),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setQrToken(data.qrToken);
        // توليد صورة QR
        const url = await QRCode.toDataURL(data.qrToken, { width: 400, margin: 1 });
        setQrImage(url);
      } else {
        alert("حدث خطأ");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#ff5c00]" /></div>;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Truck className="h-6 w-6 text-[#ff5c00]" />
          تحصيل الكاش من السائقين
        </h1>
        <p className="mt-1 text-sm text-gray-500">تسجيل المبالغ المستلمة من السائقين وتوليد رمز QR للاعتراف</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {drivers.map((driver) => (
          <div key={driver.id} className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 font-black text-lg">
                {driver.name.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-gray-900">{driver.name}</div>
                <div className="text-xs text-gray-500" dir="ltr">{driver.phone}</div>
              </div>
            </div>
            
            <div className="rounded-lg bg-gray-50 p-3 mb-4 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-600">المبلغ في ذمته:</span>
              <span className="text-lg font-black text-red-600">{driver.pendingCash.toFixed(2)} د.م</span>
            </div>

            <button
              onClick={() => {
                setSelectedDriver(driver);
                setExpectedAmount(driver.pendingCash);
                setActualAmount(driver.pendingCash.toString());
              }}
              className="w-full rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00]"
            >
              استلام الكاش
            </button>
          </div>
        ))}
        {drivers.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-3" />
            <p className="font-bold text-lg">كل الحسابات مصفاة</p>
            <p className="text-sm">لا يوجد كاش في ذمة السائقين حالياً.</p>
          </div>
        )}
      </div>

      {/* Modal استلام الكاش */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black">استلام كاش من {selectedDriver.name}</h2>
              <button onClick={() => { setSelectedDriver(null); setQrImage(""); }} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {!qrImage ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">المبلغ المفروض (في ذمته)</label>
                  <input type="text" value={expectedAmount} readOnly className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm font-bold text-gray-600 outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">المبلغ المستلم فعلياً</label>
                  <input type="number" value={actualAmount} onChange={(e) => setActualAmount(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold outline-none focus:border-[#ff5c00]" />
                </div>
                {Number(actualAmount) < expectedAmount && (
                  <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 font-bold text-center">
                    يوجد عجز بقيمة {(expectedAmount - Number(actualAmount)).toFixed(2)} د.م سيتم خصمها من محفظة السائق.
                  </div>
                )}
                <button onClick={handleCreateHandover} disabled={submitting || !actualAmount} className="w-full rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white hover:bg-[#e64a00] flex justify-center">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد وتوليد QR"}
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="bg-green-50 text-green-700 p-3 rounded-lg text-xs font-bold mb-4">
                  الرجاء مطالبة السائق بمسح هذا الرمز للاعتراف باستلام المبلغ.
                </div>
                <div className="mx-auto w-64 h-64 bg-white p-2 rounded-xl border-2 border-[#0a1f44]">
                  <img src={qrImage} alt="QR" className="w-full h-full object-contain" />
                </div>
                <button onClick={() => { setSelectedDriver(null); setQrImage(""); loadDrivers(); }} className="mt-6 w-full rounded-lg border-2 border-gray-200 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50">
                  إغلاق
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}