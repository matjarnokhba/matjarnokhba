"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Loader2 } from "lucide-react";

type Props = {
  deliveryToken: string | null;
  orderNumber?: string;
};

export default function OrderQRViewer({ deliveryToken, orderNumber }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!deliveryToken || !canvasRef.current || qrDataUrl) return;

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/d/${deliveryToken}`;

    QRCode.toCanvas(canvasRef.current, url, {
      width: 600,
      margin: 1,
      color: { dark: "#0a1f44", light: "#ffffff" },
      errorCorrectionLevel: "H",
    })
      .then(() => setQrDataUrl(canvasRef.current!.toDataURL("image/png")))
      .catch((err) => console.error("QR generation failed:", err));
  }, [deliveryToken, qrDataUrl]);

  if (!deliveryToken) {
    return (
      <div className="rounded-lg bg-gray-50 p-4 text-center text-xs text-gray-500">
        لا يوجد QR لهذا الطلب
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt={`QR ${orderNumber || ""}`}
          className="h-40 w-40 rounded-lg border-2 border-gray-200 object-contain"
        />
      ) : (
        <div className="flex h-40 w-40 items-center justify-center rounded-lg border-2 border-gray-200 bg-gray-50">
          <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        </div>
      )}
      <div
        className="max-w-[180px] truncate font-mono text-[10px] text-gray-500"
        dir="ltr"
      >
        /d/{deliveryToken.slice(0, 12)}...
      </div>
    </div>
  );
}