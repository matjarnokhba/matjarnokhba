"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, QrCode } from "lucide-react";

export default function OrderQRViewer({
  token,
  orderNumber,
}: {
  token: string;
  orderNumber: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const fullUrl = token ? `${origin}/d/${token}` : "";

  useEffect(() => {
    if (!token || !canvasRef.current) return;

    QRCode.toCanvas(canvasRef.current, fullUrl, {
      width: 400,
      margin: 1,
      color: { dark: "#0a1f44", light: "#ffffff" },
      errorCorrectionLevel: "H",
    })
      .then(() => setDataUrl(canvasRef.current!.toDataURL("image/png")))
      .catch((e) => console.error("QR gen failed:", e));
  }, [token, fullUrl]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  if (!token) {
    return (
      <div className="rounded-xl bg-amber-50 p-4 text-center text-xs text-amber-700">
        لا يوجد QR لهذا الطلب
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-4 text-center shadow-sm">
      <div className="mb-2 flex items-center justify-center gap-2 text-sm font-black">
        <QrCode className="h-4 w-4 text-[#ff5c00]" />
        QR الطلب
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div className="mx-auto my-3 flex max-w-[200px] justify-center">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`QR ${orderNumber}`}
            className="h-auto w-full rounded-lg"
            style={{ maxWidth: "100%" }}
          />
        ) : (
          <div className="aspect-square w-full animate-pulse rounded-lg bg-gray-100" />
        )}
      </div>

      <div className="text-[10px] text-gray-500 mb-2">
        Scan to open order by QR
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={handleCopy}
          className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-bold transition ${
            copied
              ? "bg-green-500 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "تم النسخ" : "نسخ الرابط"}
        </button>
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#ff5c00] py-2 text-[11px] font-bold text-white hover:bg-[#e64a00]"
        >
          فتح
        </a>
      </div>
    </div>
  );
}