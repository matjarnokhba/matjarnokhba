"use client";

import { useState } from "react";
import { Loader2, Banknote, CheckCircle2 } from "lucide-react";
import QRCode from "qrcode";

export default function WarehouseHandoverPage() {
  const [amount, setAmount] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!amount || Number(amount) <= 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/warehouse/handover/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
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

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8 flex justify-center" dir="rtl">
      <div className="w-full max-w-md">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900 mb-6">
          <Banknote className="h-6 w-6 text-teal-600" />
          تسليم الكاش للإدارة
        </h1>

        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          {!qrImage ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-gray-700">المبلغ المطلوب تسليمه</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="0.00" />
              </div>
              <button onClick={handleCreate} disabled={submitting || !amount} className="w-full rounded-lg bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-700 flex justify-center">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "توليد QR للتسليم"}
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="bg-teal-50 text-teal-700 p-3 rounded-lg text-xs font-bold mb-4">
                الرجاء مطالبة الأدمن بمسح هذا الرمز لتأكيد استلام المبلغ.
              </div>
              <div className="mx-auto w-64 h-64 bg-white p-2 rounded-xl border-2 border-teal-600">
                <img src={qrImage} alt="QR" className="w-full h-full object-contain" />
              </div>
              <button onClick={() => { setQrImage(""); setAmount(""); }} className="mt-6 w-full rounded-lg border-2 border-gray-200 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50">
                تسليم مبلغ آخر
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}