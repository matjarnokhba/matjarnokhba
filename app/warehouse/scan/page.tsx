"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { QrCode, X, AlertCircle } from "lucide-react";

export default function WarehouseScanPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const scannerRef = useRef<any>(null);
  const scannerDivId = "warehouse-qr-reader";

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch {}
      }
    };
  }, []);

  async function startScanner() {
    setScanError("");
    setScanning(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      await new Promise((r) => setTimeout(r, 100));

      const scanner = new Html5Qrcode(scannerDivId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => handleScan(decodedText),
        () => {}
      );
    } catch (err: any) {
      console.error(err);
      setScanError(
        err?.message?.includes("NotAllowedError")
          ? "تم رفض الإذن للكاميرا."
          : "فشل تشغيل الماسح."
      );
      setScanning(false);
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }

  function handleScan(text: string) {
    let token = text.trim();

    if (token.includes("/d/")) {
      const match = token.match(/\/d\/([A-Za-z0-9_-]+)/);
      if (match) token = match[1];
    }

    if (!token || token.length < 20) {
      setScanError("رمز غير صحيح");
      stopScanner();
      return;
    }

    router.push(`/d/${token}`);
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <QrCode className="h-6 w-6 text-teal-600" />
          مسح QR
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          امسح ملصق الطرد عند وصوله للمستودع
        </p>
      </div>

      <div className="mx-auto max-w-lg rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-4 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50 p-4">
          <div className="text-sm font-black text-teal-900">خطوات المستودع</div>
          <ol className="mt-2 space-y-1 text-xs text-teal-800">
            <li>1️⃣ مسح الملصق عند الوصول → استلام</li>
            <li>2️⃣ فحص المنتجات → التحقق</li>
            <li>3️⃣ تجميع في شحنة (قريبًا)</li>
          </ol>
        </div>

        {!scanning ? (
          <button
            onClick={startScanner}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-4 text-sm font-bold text-white transition hover:bg-teal-700"
          >
            <QrCode className="h-5 w-5" />
            فتح الكاميرا للمسح
          </button>
        ) : (
          <button
            onClick={stopScanner}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 py-4 text-sm font-bold text-red-600"
          >
            <X className="h-5 w-5" />
            إيقاف الماسح
          </button>
        )}

        {scanning && (
          <div className="mt-4 overflow-hidden rounded-xl">
            <div id={scannerDivId} className="w-full" />
            <p className="mt-3 text-center text-xs text-gray-500">
              وجّه الكاميرا نحو ملصق الطرد
            </p>
          </div>
        )}

        {!scanning && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="mb-2 text-xs font-bold text-gray-700">
              أو إدخال يدوي
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualCode.trim()) handleScan(manualCode.trim());
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="الصق رمز الطرد..."
                dir="ltr"
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-teal-500 focus:bg-white"
              />
              <button
                type="submit"
                className="rounded-lg bg-teal-600 px-4 text-xs font-bold text-white hover:bg-teal-700"
              >
                فتح
              </button>
            </form>
          </div>
        )}

        {scanError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{scanError}</span>
          </div>
        )}
      </div>
    </div>
  );
}