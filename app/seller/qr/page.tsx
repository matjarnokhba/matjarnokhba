"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  Store,
  ExternalLink,
} from "lucide-react";
import QRCode from "qrcode";

type SellerInfo = {
  storeName: string;
  slug: string;
};

export default function SellerQRPage() {
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ═══ تحميل بيانات التاجر ═══
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/seller/profile");
        const data = await res.json();

        if (!res.ok || !data.success || !data.seller) {
          setError("يجب تسجيل الدخول كتاجر");
          return;
        }

        const s: SellerInfo = {
          storeName: data.seller.storeName,
          slug: data.seller.slug,
        };
        setSeller(s);

        // ═══ بناء رابط المتجر ═══
        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : "https://matjarnokhba-lyart.vercel.app";
        const url = `${origin}/store/${s.slug}`;
        setStoreUrl(url);

        // ═══ توليد QR على Canvas ═══
        if (canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, url, {
            width: 1024,
            margin: 2,
            color: {
              dark: "#111827",
              light: "#ffffff",
            },
            errorCorrectionLevel: "H",
          });

          // نحوّل الـcanvas إلى dataURL للعرض والتحميل
          const dataUrl = canvasRef.current.toDataURL("image/png");
          setQrDataUrl(dataUrl);
        }
      } catch (err) {
        console.error(err);
        setError("فشل تحميل البيانات");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ═══ تحميل PNG ═══
  function handleDownload() {
    if (!qrDataUrl || !seller) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `qr-${seller.slug}.png`;
    link.click();
  }

  // ═══ نسخ الرابط ═══
  async function handleCopy() {
    if (!storeUrl) return;
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  }

  // ═══ طباعة ═══
  function handlePrint() {
    if (!qrDataUrl || !seller) return;

    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>QR — ${seller.storeName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: #fff;
            padding: 40px;
          }
          .card {
            width: 100%;
            max-width: 500px;
            text-align: center;
            padding: 40px;
            border: 4px solid #ff5c00;
            border-radius: 24px;
            background: #fff;
          }
          .logo {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 70px;
            height: 70px;
            border-radius: 16px;
            background: linear-gradient(135deg, #6d28d9, #ff5c00);
            color: white;
            font-size: 32px;
            font-weight: 900;
            margin-bottom: 20px;
          }
          h1 {
            font-size: 28px;
            color: #111827;
            margin-bottom: 8px;
          }
          .subtitle {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 24px;
          }
          img {
            width: 100%;
            max-width: 320px;
            height: auto;
            border-radius: 12px;
            margin: 0 auto 24px;
            display: block;
          }
          .instruction {
            background: #fff4ed;
            color: #ff5c00;
            padding: 12px 20px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 14px;
            margin-bottom: 16px;
          }
          .url {
            font-family: monospace;
            font-size: 11px;
            color: #6b7280;
            word-break: break-all;
          }
          @media print {
            body { padding: 0; }
            .card { border-width: 3px; }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">ن</div>
          <h1>${seller.storeName}</h1>
          <div class="subtitle">امسح الرمز لزيارة متجرنا</div>
          <img src="${qrDataUrl}" alt="QR Code" />
          <div class="instruction">📱 افتح كاميرا هاتفك وامسح الرمز</div>
          <div class="url">${storeUrl}</div>
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => { window.print(); }, 300);
          };
        </script>
      </body>
      </html>
    `);
    win.document.close();
  }

  // ═══ التحميل ═══
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-xl bg-red-50 p-8 text-center text-red-700">
          {error || "حدث خطأ"}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* ═══ الـCanvas المخفي ═══ */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <Link
        href="/seller"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع
      </Link>

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <QrCode className="h-6 w-6 text-[#ff5c00]" />
          رمز QR لمتجرك
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          اطبع الرمز وضعه في متجرك أو استخدمه في إعلاناتك. عند مسحه، يفتح
          متجرك مباشرة.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ═══ بطاقة QR للعرض ═══ */}
        <div className="rounded-2xl border-4 border-[#ff5c00] bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-orange-500 text-2xl font-black text-white">
            ن
          </div>
          <h2 className="text-xl font-black text-gray-900">
            {seller.storeName}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            امسح الرمز لزيارة متجرنا
          </p>

          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code"
              className="mx-auto my-6 w-full max-w-[280px] rounded-xl"
            />
          ) : (
            <div className="mx-auto my-6 flex h-[280px] w-[280px] items-center justify-center rounded-xl bg-gray-100">
              <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
            </div>
          )}

          <div className="rounded-xl bg-[#fff4ed] px-4 py-3 text-xs font-bold text-[#ff5c00]">
            📱 افتح كاميرا هاتفك وامسح الرمز
          </div>
        </div>

        {/* ═══ الإجراءات ═══ */}
        <div className="space-y-4">
          {/* رابط المتجر */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-gray-700">
              <Store className="h-4 w-4 text-[#ff5c00]" />
              رابط متجرك
            </h3>
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
              <span className="flex-1 truncate font-mono text-[11px] text-gray-700" dir="ltr">
                {storeUrl}
              </span>
              <button
                onClick={handleCopy}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                  copied
                    ? "bg-green-500 text-white"
                    : "bg-white text-gray-500 hover:bg-gray-100"
                }`}
                aria-label="نسخ"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#ff5c00] hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              فتح المتجر
            </a>
          </div>

          {/* أزرار التحميل والطباعة */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-gray-700">
              تصدير الرمز
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleDownload}
                disabled={!qrDataUrl}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                تحميل PNG
              </button>
              <button
                onClick={handlePrint}
                disabled={!qrDataUrl}
                className="flex items-center justify-center gap-2 rounded-lg border-2 border-[#ff5c00] bg-white py-3 text-sm font-bold text-[#ff5c00] transition hover:bg-[#fff4ed] disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                طباعة
              </button>
            </div>
            <p className="mt-3 text-[11px] text-gray-500">
              💡 اطبع الرمز بحجم كبير وضعه في مدخل متجرك أو في بطاقات
              العمل. يعمل مع أي تطبيق كاميرا.
            </p>
          </div>

          {/* نصائح */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h3 className="mb-2 text-sm font-black text-blue-900">
              💡 أفكار للاستخدام
            </h3>
            <ul className="space-y-1.5 text-xs text-blue-800">
              <li>• لصق الرمز على واجهة المتجر</li>
              <li>• وضعه في الفواتير المطبوعة</li>
              <li>• إضافته لبطاقات العمل</li>
              <li>• مشاركته في السوشيال ميديا</li>
              <li>• تضمينه في إعلانات مطبوعة</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}