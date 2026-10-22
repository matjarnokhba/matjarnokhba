"use client";

import { useState, useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import { Scan, X, Loader2, AlertCircle, CheckCircle2, Wallet } from "lucide-react";
import Link from "next/link";

export default function DeliveryCashHandoverPage() {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ amount: number; shortfall: number } | null>(null);
  
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
              
              const token = result.getText();
              await confirmHandover(token);
            }
          }
        );
        controlsRef.current = controls;
      } catch (err) {
        console.error(err);
        setError("تعذر فتح الكاميرا");
        setScanning(false);
      }
    }, 300);
  }

  async function stopScanner() {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    setScanning(false);
  }

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  async function confirmHandover(token: string) {
    if (loading) return;
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch("/api/delivery/cash-handover/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل تأكيد التسليم");
        return;
      }

      await stopScanner();
      setSuccessData({
        amount: Number(data.amountReceived),
        shortfall: Number(data.shortfallDeducted || 0)
      });
      
    } catch (err) {
      setError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  if (successData) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8 flex justify-center" dir="rtl">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg border border-green-100">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">تم تسليم المبلغ بنجاح</h1>
          
          <div className="mt-6 space-y-3">
            <div className="rounded-lg bg-gray-50 p-3 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-600">المبلغ المسلم:</span>
              <span className="text-lg font-black text-green-600">{successData.amount.toFixed(2)} د.م</span>
            </div>
            
            {successData.shortfall > 0 && (
              <div className="rounded-lg bg-red-50 p-3 flex justify-between items-center border border-red-100">
                <span className="text-sm font-bold text-red-700">تم خصم عجز بقيمة:</span>
                <span className="text-lg font-black text-red-600">{successData.shortfall.toFixed(2)} د.م</span>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-2">
            <Link href="/delivery" className="w-full rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white hover:bg-[#e64a00] transition">
              العودة للوحة التحكم
            </Link>
            <button onClick={() => { setSuccessData(null); setError(""); }} className="w-full rounded-lg border border-gray-200 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition">
              مسح تسليم آخر
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 pb-24 lg:p-8 lg:pt-8 min-h-screen" dir="rtl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Wallet className="h-6 w-6 text-[#ff5c00]" />
          تسليم الكاش للمستودع
        </h1>
        <p className="mt-1 text-sm text-gray-500">امسح رمز QR المعروض على شاشة أمين المستودع لتأكيد تسليم المبلغ.</p>
      </div>

      <div className="mx-auto max-w-lg space-y-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          {!scanning ? (
            <button onClick={startScanner} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3.5 text-sm font-bold text-white hover:bg-[#e64a00] disabled:opacity-50">
              <Scan className="h-5 w-5" /> فتح الكاميرا للمسح
            </button>
          ) : (
            <button onClick={stopScanner} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 py-3.5 text-sm font-bold text-red-600 hover:bg-red-100">
              <X className="h-5 w-5" /> إيقاف الماسح
            </button>
          )}

          {scanning && (
            <div className="mt-4 overflow-hidden rounded-xl">
              <div id={scannerDivId} className="relative w-full min-h-[300px] bg-black" />
            </div>
          )}

          {loading && <div className="mt-3 text-center text-sm font-bold text-blue-600">جاري التحقق من الرمز...</div>}
          {error && <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-5 w-5" />{error}</div>}
        </div>
      </div>
    </div>
  );
}