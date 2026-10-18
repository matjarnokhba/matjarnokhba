"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  QrCode,
  X,
  CheckCircle2,
  AlertCircle,
  Package,
} from "lucide-react";

export default function AssemblyScanPage() {
  const params = useParams();
  const router = useRouter();
  const assemblyId = params.id as string;

  const [scanning, setScanning] = useState(false);
  const [scanning_processing, setProcessing] = useState(false);
  const [scanError, setScanError] = useState("");
  const [lastResult, setLastResult] = useState<{
    orderNumber: string;
    alreadyScanned: boolean;
    readiness: any;
  } | null>(null);
  const [manualCode, setManualCode] = useState("");

  const scannerRef = useRef<any>(null);
  const scannerDivId = "assembly-order-qr-reader";
  const lastScanRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

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
      await new Promise((r) => setTimeout(r, 150));

      const scanner = new Html5Qrcode(scannerDivId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          const now = Date.now();
          if (
            decodedText === lastScanRef.current &&
            now - lastScanTimeRef.current < 2000
          ) {
            return;
          }
          lastScanRef.current = decodedText;
          lastScanTimeRef.current = now;
          handleScan(decodedText);
        },
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

  async function handleScan(text: string) {
    if (scanning_processing) return;

    let token = text.trim();
    if (token.includes("/d/")) {
      const match = token.match(/\/d\/([A-Za-z0-9_-]+)/);
      if (match) token = match[1];
    }

    if (!token || token.length < 20) {
      setScanError("رمز غير صحيح");
      return;
    }

    await submitScan(token);
  }

  async function submitScan(token: string) {
    setProcessing(true);
    setScanError("");

    try {
      const res = await fetch(
        `/api/warehouse/assembly/${assemblyId}/scan-order`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setScanError(data.message || "فشل المسح");
        return;
      }

      setLastResult({
        orderNumber: data.orderNumber,
        alreadyScanned: data.alreadyScanned,
        readiness: data.readiness,
      });
    } catch {
      setScanError("فشل الاتصال");
    } finally {
      setProcessing(false);
    }
  }

  const readiness = lastResult?.readiness;
  const allDone =
    readiness &&
    readiness.mustScan?.length === 0 &&
    readiness.inTransit?.length === 0;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href={`/warehouse/assembly/${assemblyId}`}
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-teal-600"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للتجميع
      </Link>

      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <QrCode className="h-6 w-6 text-teal-600" />
          مسح QR الطلبيات
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          امسح QR كل طلب موجود في المستودع
        </p>
      </div>

      {/* نتيجة آخر مسح */}
      {lastResult && (
        <div
          className={`mb-4 rounded-2xl border-2 p-4 ${
            allDone
              ? "border-green-300 bg-green-50"
              : "border-teal-200 bg-teal-50"
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 className={`h-5 w-5 ${allDone ? "text-green-600" : "text-teal-600"}`} />
            <div className="text-sm font-black">
              {lastResult.alreadyScanned ? "ممسوح مسبقاً" : "✅ تم المسح"} — {lastResult.orderNumber}
            </div>
          </div>

          {readiness && (
            <div className="space-y-1 text-xs">
              <div>
                ✅ ممسوحة: {readiness.orders.filter((o: any) => o.scanned).length} / {readiness.orders.length}
              </div>
              {readiness.mustScan?.length > 0 && (
                <div className="font-bold text-amber-700">
                  ⚠️ {readiness.mustScan.length} طلب لم يمسح بعد
                </div>
              )}
              {readiness.inTransit?.length > 0 && (
                <div className="font-bold text-blue-700">
                  🚚 {readiness.inTransit.length} طلب في الطريق
                </div>
              )}
            </div>
          )}

          {allDone && (
            <Link
              href={`/warehouse/assembly/${assemblyId}`}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white transition hover:bg-green-700"
            >
              <Package className="h-4 w-4" />
              العودة للتجميع — إنشاء الشحنة
            </Link>
          )}
        </div>
      )}

      {scanError && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{scanError}</span>
        </div>
      )}

      {/* Scanner */}
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-5 shadow-sm">
        {!scanning ? (
          <button
            onClick={startScanner}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-4 text-sm font-bold text-white transition hover:bg-teal-700"
          >
            <QrCode className="h-5 w-5" />
            فتح الكاميرا
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
            <div className="mt-3 text-center text-xs text-gray-500">
              {scanning_processing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
                  جاري معالجة المسح...
                </span>
              ) : (
                "وجّه الكاميرا نحو QR الطلبية"
              )}
            </div>
          </div>
        )}

        {!scanning && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="mb-2 text-xs font-bold text-gray-700">
              أو إدخال يدوي للرمز
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualCode.trim()) {
                  handleScan(manualCode.trim());
                  setManualCode("");
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="الصق رمز الطلبية..."
                dir="ltr"
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-teal-500 focus:bg-white"
              />
              <button
                type="submit"
                disabled={!manualCode.trim() || scanning_processing}
                className="rounded-lg bg-teal-600 px-4 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {scanning_processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "مسح"
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}