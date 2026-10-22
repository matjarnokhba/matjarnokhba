"use client";

import { useState, useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import { Scan, X, Loader2, CheckCircle2, Banknote } from "lucide-react";

export default function AdminHandoverPage() {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<number | null>(null);
  const [error, setError] = useState("");
  
  const controlsRef = useRef<any>(null);
  const lastScanTimeRef = useRef<number>(0);
  const scannerDivId = "qr-reader";

  async function startScanner() {
    setError("");
    setScanning(true);

    setTimeout(async () => {
      try {
        const container = document.getElementById(scannerDivId);
        if (!container) return;
        container.innerHTML = "";

        const video = document.createElement("video");
        video.setAttribute("playsinline", "true");
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = "cover";
        container.appendChild(video);

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const codeReader = new BrowserMultiFormatReader(hints);

        const controls = await codeReader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          video,
          async (result: any) => {
            if (result) {
              const now = Date.now();
              if (now - lastScanTimeRef.current < 2000) return;
              lastScanTimeRef.current = now;
              try { if (navigator.vibrate) navigator.vibrate(100); } catch (e) {}
              await confirmHandover(result.getText());
            }
          }
        );
        controlsRef.current = controls;
      } catch (err) {
        setError("تعذر فتح الكاميرا");
        setScanning(false);
      }
    }, 300);
  }

  async function stopScanner() {
    if (controlsRef.current) { controlsRef.current.stop(); controlsRef.current = null; }
    setScanning(false);
  }

  useEffect(() => { return () => { stopScanner(); }; }, []);

  async function confirmHandover(token: string) {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/handover/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || "فشل"); return; }
      await stopScanner();
      setSuccessData(data.amountReceived);
    } catch (err) { setError("فشل الاتصال"); } finally { setLoading(false); }
  }

  if (successData) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8 flex justify-center" dir="rtl">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg border border-green-100">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">تم استلام الكاش بنجاح</h1>
          <div className="mt-6 rounded-lg bg-gray-50 p-3 flex justify-between items-center">
            <span className="text-sm font-bold text-gray-600">المبلغ المستلم:</span>
            <span className="text-lg font-black text-green-600">{successData.toFixed(2)} د.م</span>
          </div>
          <button onClick={() => { setSuccessData(null); setError(""); }} className="mt-8 w-full rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white hover:bg-[#e64a00]">
            مسح تسليم آخر
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 pb-24 lg:p-8 lg:pt-8 min-h-screen" dir="rtl">
      <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900 mb-6">
        <Banknote className="h-6 w-6 text-[#ff5c00]" />
        استلام كاش من المستودع
      </h1>
      <div className="mx-auto max-w-lg space-y-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          {!scanning ? (
            <button onClick={startScanner} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3.5 text-sm font-bold text-white hover:bg-[#e64a00]">
              <Scan className="h-5 w-5" /> فتح الكاميرا للمسح
            </button>
          ) : (
            <button onClick={stopScanner} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 py-3.5 text-sm font-bold text-red-600 hover:bg-red-100">
              <X className="h-5 w-5" /> إيقاف الماسح
            </button>
          )}
          {scanning && <div className="mt-4 overflow-hidden rounded-xl"><div id={scannerDivId} className="relative w-full min-h-[300px] bg-black" /></div>}
          {loading && <div className="mt-3 text-center text-sm font-bold text-blue-600">جاري التحقق...</div>}
          {error && <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><X className="h-5 w-5" />{error}</div>}
        </div>
      </div>
    </div>
  );
}