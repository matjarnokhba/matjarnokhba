"use client";

import { useEffect, useState } from "react";
import { Loader2, Banknote, CheckCircle2, QrCode, X, AlertTriangle } from "lucide-react";
import QRCode from "qrcode";

type DriverWallet = {
  id: number;
  name: string;
  phone: string | null;
  balance: number;
  cashInHand: number;
  isBlocked: boolean;
};

export default function WarehouseDriverPayoutsPage() {
  const [drivers, setDrivers] = useState<DriverWallet[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedDriver, setSelectedDriver] = useState<DriverWallet | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"CASH" | "BANK">("CASH");
  const [qrImage, setQrImage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadDrivers() {
    try {
      const res = await fetch("/api/warehouse/drivers/wallet/pending");
      const data = await res.json();
      if (data.success) {
        setDrivers(data.drivers);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDrivers(); }, []);

  function openModal(driver: DriverWallet) {
    setSelectedDriver(driver);
    setAmount(driver.balance.toString());
    setQrImage("");
    setError("");
  }

  async function handleCreatePayout() {
    if (!selectedDriver) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/warehouse/driver-payout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: selectedDriver.id, amount: Number(amount), method }),
      });
      const data = await res.json();
      if (data.success) {
        const url = await QRCode.toDataURL(data.qrToken, { width: 400, margin: 1 });
        setQrImage(url);
      } else {
        setError(data.message || "حدث خطأ");
      }
    } catch (e) {
      setError("فشل الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-teal-600" /></div>;

  const eligibleDrivers = drivers.filter(d => d.balance > 0 && !d.isBlocked);
  const blockedDrivers = drivers.filter(d => d.isBlocked);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Banknote className="h-6 w-6 text-teal-600" />
          دفع أجور السائقين
        </h1>
        <p className="mt-1 text-sm text-gray-500">تسليم مستحقات السائقين (13 د.م لكل توصيل) - يُفضل القيام بذلك كل يوم اثنين</p>
      </div>

      {/* ═══ تحذير السائقين المحظورين ═══ */}
      {blockedDrivers.length > 0 && (
        <div className="mb-6 rounded-xl bg-red-50 border-2 border-red-200 p-4">
          <div className="flex items-start gap-2 text-red-800">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">يوجد {blockedDrivers.length} سائق لم يسلّم الكاش بعد</div>
              <div className="text-xs mt-1">لا يمكن دفع أجورهم حتى يسلموا الكاش للمستودع.</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {eligibleDrivers.map((driver) => (
          <div key={driver.id} className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700 font-black text-lg">
                {driver.name.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-gray-900">{driver.name}</div>
                <div className="text-xs text-gray-500" dir="ltr">{driver.phone}</div>
              </div>
            </div>
            
            <div className="rounded-lg bg-green-50 p-3 mb-4 flex justify-between items-center">
              <span className="text-xs font-bold text-green-700">رصيده المستحق:</span>
              <span className="text-lg font-black text-green-600">{driver.balance.toFixed(2)} د.م</span>
            </div>

            <button
              onClick={() => openModal(driver)}
              className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700"
            >
              دفع الأجر
            </button>
          </div>
        ))}
        {eligibleDrivers.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-3" />
            <p className="font-bold text-lg">لا يوجد سائقون مستحقون للدفع حالياً</p>
            <p className="text-sm">جميع السائقين تم دفع أجورهم، أو ليس لديهم رصيد متاح.</p>
          </div>
        )}
      </div>

      {selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black">دفع أجر {selectedDriver.name}</h2>
              <button onClick={() => { setSelectedDriver(null); setQrImage(""); }} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {!qrImage ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">المبلغ المدفوع</label>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} max={selectedDriver.balance} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-lg font-bold outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">طريقة الدفع</label>
                  <select value={method} onChange={(e) => setMethod(e.target.value as "CASH"|"BANK")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold outline-none focus:border-teal-500">
                    <option value="CASH">نقداً (يداً بيد)</option>
                    <option value="BANK">تحويل بنكي</option>
                  </select>
                </div>
                {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
                <button onClick={handleCreatePayout} disabled={submitting || !amount} className="w-full rounded-lg bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-700 flex justify-center disabled:opacity-50">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد وتوليد QR"}
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="bg-teal-50 text-teal-700 p-3 rounded-lg text-xs font-bold mb-4">
                  الرجاء مطالبة السائق بمسح هذا الرمز للاعتراف باستلام الأجر.
                </div>
                <div className="mx-auto w-64 h-64 bg-white p-2 rounded-xl border-2 border-teal-600">
                  <img src={qrImage} alt="QR" className="w-full h-full object-contain" />
                </div>
                <button onClick={() => { setSelectedDriver(null); setQrImage(""); loadDrivers(); }} className="mt-6 w-full rounded-lg border-2 border-gray-200 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50">
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