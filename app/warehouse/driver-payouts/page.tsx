"use client";

import { useEffect, useState } from "react";
import { Loader2, Banknote, CheckCircle2, QrCode, X } from "lucide-react";
import QRCode from "qrcode";

type DriverWallet = {
  id: number;
  name: string;
  phone: string | null;
  balance: number;
};

export default function WarehouseDriverPayoutsPage() {
  const [drivers, setDrivers] = useState<DriverWallet[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedDriver, setSelectedDriver] = useState<DriverWallet | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"CASH" | "BANK">("CASH");
  const [qrImage, setQrImage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadDrivers() {
    try {
      // نستخدم مسار جلب أرصدة السائقين (سننشئه في الخطوة التالية)
      const res = await fetch("/api/warehouse/drivers/wallet/pending");
      const data = await res.json();
      if (data.success) {
        setDrivers(data.drivers.filter((d: DriverWallet) => d.balance > 0));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDrivers(); }, []);

  async function handleCreatePayout() {
    if (!selectedDriver) return;
    setSubmitting(true);
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
        alert("حدث خطأ");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-teal-600" /></div>;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Banknote className="h-6 w-6 text-teal-600" />
          دفع أجور السائقين
        </h1>
        <p className="mt-1 text-sm text-gray-500">تسليم مستحقات السائقين (13 درهم لكل توصيل)</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {drivers.map((driver) => (
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
            
            <div className="rounded-lg bg-gray-50 p-3 mb-4 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-600">رصيده المستحق:</span>
              <span className="text-lg font-black text-teal-600">{driver.balance.toFixed(2)} د.م</span>
            </div>

            <button
              onClick={() => { setSelectedDriver(driver); setAmount(driver.balance.toString()); }}
              className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700"
            >
              دفع الأجر
            </button>
          </div>
        ))}
        {drivers.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-3" />
            <p className="font-bold text-lg">كل السائقين تم دفع أجورهم</p>
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
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">طريقة الدفع</label>
                  <select value={method} onChange={(e) => setMethod(e.target.value as "CASH"|"BANK")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold outline-none focus:border-teal-500">
                    <option value="CASH">نقداً (يداً بيد)</option>
                    <option value="BANK">تحويل بنكي</option>
                  </select>
                </div>
                <button onClick={handleCreatePayout} disabled={submitting || !amount} className="w-full rounded-lg bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-700 flex justify-center">
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