"use client";

import { useState, useRef, useEffect } from "react";
import { QrCode, Barcode, Camera, X, Loader2, Check } from "lucide-react";

type CodeType = "BARCODE" | "QR";

type Props = {
  value: string;
  codeType: CodeType;
  onChange: (value: string, codeType: CodeType) => void;
  label?: string;
  helperText?: string;
  placeholder?: string;
};

export default function QRCodeInput({
  value,
  codeType,
  onChange,
  label = "الباركود أو QR",
  helperText,
  placeholder = "امسح أو اكتب...",
}: Props) {
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<any>(null);

  async function startScanner() {
    setShowScanner(true);
    setScanError("");
    setScanning(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-scanner-container");
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText: string) => {
          // Auto-detect type
          const type: CodeType = decodedText.length > 50 ? "QR" : "BARCODE";
          onChange(decodedText, type);
          stopScanner();
        },
        () => {
          // Silent fail (frame decode errors)
        }
      );
    } catch (err) {
      console.error("Scanner error:", err);
      setScanError("تعذر فتح الكاميرا — تحقق من الصلاحيات");
      setScanning(false);
    }
  }

  async function stopScanner() {
    try {
      if (html5QrRef.current) {
        await html5QrRef.current.stop();
        await html5QrRef.current.clear();
      }
    } catch {}
    html5QrRef.current = null;
    setShowScanner(false);
    setScanning(false);
  }

  useEffect(() => {
    return () => {
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-gray-700">{label}</label>

      {/* Type toggle */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onChange(value, "BARCODE")}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            codeType === "BARCODE"
              ? "bg-[#ff5c00] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <Barcode className="h-3.5 w-3.5" />
          باركود
        </button>
        <button
          type="button"
          onClick={() => onChange(value, "QR")}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            codeType === "QR"
              ? "bg-[#ff5c00] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <QrCode className="h-3.5 w-3.5" />
          QR
        </button>
      </div>

      {/* Input + scan button */}
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value, codeType)}
          placeholder={placeholder}
          dir="ltr"
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-[#ff5c00]"
        />
        <button
          type="button"
          onClick={startScanner}
          className="flex items-center gap-1.5 rounded-lg bg-[#ff5c00] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#e64a00]"
        >
          <Camera className="h-4 w-4" />
          مسح
        </button>
      </div>

      {helperText && <p className="text-[10px] text-gray-500">{helperText}</p>}

      {/* Scanner modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black">
                مسح {codeType === "QR" ? "QR" : "الباركود"}
              </h3>
              <button
                onClick={stopScanner}
                className="rounded-full p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              id="qr-scanner-container"
              ref={scannerRef}
              className="aspect-square w-full overflow-hidden rounded-lg bg-black"
            />

            {scanning && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin text-[#ff5c00]" />
                جاري المسح...
              </div>
            )}

            {scanError && (
              <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                {scanError}
              </div>
            )}

            <p className="mt-3 text-center text-[10px] text-gray-500">
              وجّه الكاميرا نحو {codeType === "QR" ? "رمز QR" : "الباركود"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}