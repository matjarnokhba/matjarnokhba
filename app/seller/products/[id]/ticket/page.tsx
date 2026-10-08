"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Download,
  Printer,
  QrCode,
  RefreshCw,
} from "lucide-react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

type ProductData = {
  id: number;
  productCode: string;
  name: string;
  brand: string;
  imageUrls: string[];
  categoryId: number;
};

type SellerInfo = {
  storeName: string;
  slug: string;
};

export default function ProductTicketPage() {
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<ProductData | null>(null);
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [barcodeDataUrl, setBarcodeDataUrl] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [qrGenerating, setQrGenerating] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  // ═══ 1. تحميل البيانات ═══
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      setQrDataUrl("");
      setBarcodeDataUrl("");

      try {
        const [prodRes, sellerRes] = await Promise.all([
          fetch(`/api/seller/products/${productId}`),
          fetch("/api/seller/profile"),
        ]);

        const prodData = await prodRes.json();
        const sellerData = await sellerRes.json();

        if (!prodRes.ok || !prodData.success) {
          setError(prodData.message || "المنتج غير موجود");
          return;
        }
        if (!sellerRes.ok || !sellerData.success || !sellerData.seller) {
          setError("يجب تسجيل الدخول كتاجر");
          return;
        }

        setProduct(prodData.product);
        setSeller({
          storeName: sellerData.seller.storeName,
          slug: sellerData.seller.slug,
        });

        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : "https://matjarnokhba-lyart.vercel.app";
        setProductUrl(`${origin}/p/${prodData.product.productCode}`);
      } catch (err) {
        console.error(err);
        setError("فشل تحميل البيانات");
      } finally {
        setLoading(false);
      }
    }
    if (productId) load();
  }, [productId, refreshKey]);

  // ═══ 2. توليد QR + Barcode (بعد وجود canvas في DOM) ═══
  useEffect(() => {
    if (loading || !product || !seller || !productUrl) return;
    if (qrDataUrl || barcodeDataUrl) return;

    // ═══ التقاط المراجع محلياً (لحل مشكلة TS narrowing) ═══
    const currentProduct = product;
    const currentProductUrl = productUrl;

    async function generate() {
      setQrGenerating(true);
      try {
        // ═══ QR ═══
        if (qrCanvasRef.current) {
          await QRCode.toCanvas(qrCanvasRef.current, currentProductUrl, {
            width: 800,
            margin: 1,
            color: { dark: "#0a1f44", light: "#ffffff" },
            errorCorrectionLevel: "H",
          });
          setQrDataUrl(qrCanvasRef.current.toDataURL("image/png"));
        }

        // ═══ Barcode ═══
        const shortCode = currentProduct.productCode
          .slice(0, 8)
          .toUpperCase();
        if (barcodeRef.current) {
          JsBarcode(barcodeRef.current, shortCode, {
            format: "CODE128",
            width: 1.2,
            height: 22,
            displayValue: true,
            fontSize: 10,
            font: "monospace",
            textMargin: 2,
            margin: 3,
            background: "#ffffff",
            lineColor: "#0a1f44",
          });

          const svgElement = barcodeRef.current;
          const serializer = new XMLSerializer();
          const svgString = serializer.serializeToString(svgElement);
          const svgBlob = new Blob([svgString], {
            type: "image/svg+xml;charset=utf-8",
          });
          const svgUrl = URL.createObjectURL(svgBlob);

          const img = new Image();
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = svgUrl;
          });

          const canvas = document.createElement("canvas");
          const scale = 4;
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            setBarcodeDataUrl(canvas.toDataURL("image/png"));
          }
          URL.revokeObjectURL(svgUrl);
        }
      } catch (err) {
        console.error("Ticket generation failed:", err);
      } finally {
        setQrGenerating(false);
      }
    }
    generate();
  }, [loading, product, seller, productUrl, qrDataUrl, barcodeDataUrl]);

  function handleDownloadQR() {
    if (!qrDataUrl || !product) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `qr-product-${product.productCode.slice(0, 8)}.png`;
    link.click();
  }

  function handlePrint() {
    if (!qrDataUrl || !product || !seller) return;

    const win = window.open("", "_blank");
    if (!win) return;

    const mainImage = product.imageUrls[0] || "";
    const shortCode = product.productCode.slice(0, 8).toUpperCase();

    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>Ticket — ${product.name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, sans-serif;
            background: #f3f4f6;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .ticket {
            width: 320px;
            background: #fff;
            border-radius: 14px;
            overflow: hidden;
            border: 2px solid #0a1f44;
          }
          .qr-section {
            padding: 8px 8px 6px;
            text-align: center;
            background: #f9fafb;
            border-bottom: 2px solid #0a1f44;
          }
          .qr-frame {
            position: relative;
            width: 190px;
            height: 190px;
            margin: 0 auto 6px;
            padding: 7px;
            background: #fff;
            border-radius: 12px;
          }
          .qr-frame::before,
          .qr-frame::after,
          .qr-frame > .corner-bl,
          .qr-frame > .corner-br {
            content: '';
            position: absolute;
            width: 20px;
            height: 20px;
            border: 3px solid #0a1f44;
          }
          .qr-frame::before {
            top: 0; right: 0;
            border-left: 0; border-bottom: 0;
            border-top-right-radius: 12px;
          }
          .qr-frame::after {
            top: 0; left: 0;
            border-right: 0; border-bottom: 0;
            border-top-left-radius: 12px;
          }
          .qr-frame > .corner-bl {
            bottom: 0; left: 0;
            border-right: 0; border-top: 0;
            border-bottom-left-radius: 12px;
          }
          .qr-frame > .corner-br {
            bottom: 0; right: 0;
            border-left: 0; border-top: 0;
            border-bottom-right-radius: 12px;
          }
          .qr-frame img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
          }
          .qr-hint {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            font-size: 9px;
            font-weight: 700;
            color: #0a1f44;
            line-height: 1.25;
          }
          .phone-icon { font-size: 14px; }

          .product-hero {
            display: flex;
            align-items: stretch;
            gap: 4px;
            padding: 8px 6px;
          }
          .hero-info {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 5px;
          }
          .hero-store {
            display: flex;
            align-items: center;
            gap: 6px;
            padding-bottom: 5px;
            border-bottom: 1px solid #e5e7eb;
            overflow: hidden;
          }
          .hero-logo {
            width: 36px;
            height: 36px;
            border-radius: 9px;
            background: linear-gradient(135deg, #0a1f44, #6d28d9);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-weight: 900;
            font-size: 16px;
            flex-shrink: 0;
          }
          .hero-store-name {
            font-size: 40px;
            font-weight: 900;
            color: #0a1f44;
            line-height: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .hero-store-tagline {
            font-size: 9px;
            color: #6b7280;
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .hero-product-row {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }
          .hero-product-name {
            font-size: 26px;
            font-weight: 900;
            color: #111827;
            line-height: 1.1;
            flex: 1;
            min-width: 0;
          }
          .hero-brand {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 12px;
            background: #f3f4f6;
            border-radius: 999px;
            font-size: 20px;
            font-weight: 900;
            color: #0a1f44;
            flex-shrink: 0;
          }
          .hero-brand-icon { font-size: 16px; }
          .barcode-box {
            margin-top: 2px;
            padding: 4px 2px 2px;
            background: #fff;
            border-top: 1px dashed #d1d5db;
            text-align: center;
          }
          .barcode-box img {
            width: 100%;
            max-width: 100%;
            height: auto;
            display: block;
          }
          .hero-image {
            width: 30%;
            aspect-ratio: 1 / 1;
            align-self: center;
            overflow: hidden;
            background: #f9fafb;
            border-radius: 8px;
            flex-shrink: 0;
          }
          .hero-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
          @media print {
            body { background: #fff; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="qr-section">
            <div class="qr-frame">
              <span class="corner-bl"></span>
              <span class="corner-br"></span>
              <img src="${qrDataUrl}" alt="QR" />
            </div>
            <div class="qr-hint">
              <span class="phone-icon">📱</span>
              <span>امسح الرمز لعرض تفاصيل المنتج<br/>والمزيد من الصور</span>
            </div>
          </div>

          <div class="product-hero">
            <div class="hero-info">
              <div class="hero-store">
                <div class="hero-logo">ن</div>
                <div style="min-width: 0; flex: 1;">
                  <div class="hero-store-name">${seller.storeName}</div>
                  <div class="hero-store-tagline">جودة تستحق ثقتك</div>
                </div>
              </div>

              <div class="hero-product-row">
                <div class="hero-product-name">${product.name}</div>
                ${
                  product.brand
                    ? `<div class="hero-brand">
                         <span class="hero-brand-icon">🏷️</span>
                         ${product.brand}
                       </div>`
                    : ""
                }
              </div>

              ${
                barcodeDataUrl
                  ? `<div class="barcode-box">
                       <img src="${barcodeDataUrl}" alt="barcode" />
                     </div>`
                  : ""
              }
            </div>

            <div class="hero-image">
              ${mainImage ? `<img src="${mainImage}" alt="" />` : ""}
            </div>
          </div>
        </div>

        <script>
          window.onload = () => {
            setTimeout(() => { window.print(); }, 600);
          };
        </script>
      </body>
      </html>
    `);
    win.document.close();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (error || !product || !seller) {
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
      <canvas ref={qrCanvasRef} style={{ display: "none" }} />
      <svg ref={barcodeRef} style={{ display: "none" }} />

      <Link
        href={`/seller/products/${productId}`}
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للمنتج
      </Link>

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <QrCode className="h-6 w-6 text-[#ff5c00]" />
          بطاقة المنتج (QR Ticket)
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          اطبع هذه البطاقة والصقها على المنتج في محلك.
        </p>
      </div>

      {(!product.imageUrls || product.imageUrls.length === 0) && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <span className="text-lg">⚠️</span>
          <div className="text-xs text-amber-800">
            هذا المنتج ليس له صور. بطاقة QR قد لا تعمل بشكل صحيح.
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex justify-center">
          <div className="w-full max-w-[320px] overflow-hidden rounded-2xl border-2 border-[#0a1f44] bg-white shadow-lg">
            <div className="border-b-2 border-[#0a1f44] bg-gray-50 px-2 pb-1.5 pt-2 text-center">
              <div className="relative mx-auto mb-1.5 h-48 w-48 rounded-xl bg-white p-1.5">
                <span className="absolute right-0 top-0 h-5 w-5 rounded-tr-xl border-r-[3px] border-t-[3px] border-[#0a1f44]" />
                <span className="absolute left-0 top-0 h-5 w-5 rounded-tl-xl border-l-[3px] border-t-[3px] border-[#0a1f44]" />
                <span className="absolute bottom-0 left-0 h-5 w-5 rounded-bl-xl border-b-[3px] border-l-[3px] border-[#0a1f44]" />
                <span className="absolute bottom-0 right-0 h-5 w-5 rounded-br-xl border-b-[3px] border-r-[3px] border-[#0a1f44]" />

                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-[#ff5c00]" />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-1 text-[9px] font-bold leading-tight text-[#0a1f44]">
                <span className="text-sm">📱</span>
                <span>
                  امسح الرمز لعرض تفاصيل المنتج
                  <br />
                  والمزيد من الصور
                </span>
              </div>
            </div>

            <div className="flex items-stretch gap-1 p-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-1.5 overflow-hidden border-b border-gray-200 pb-1.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0a1f44] to-purple-600 text-sm font-black text-white">
                    ن
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[40px] font-black leading-none text-[#0a1f44]">
                      {seller.storeName}
                    </div>
                    <div className="mt-0.5 truncate text-[9px] text-gray-500">
                      جودة تستحق ثقتك
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1 text-[26px] font-black leading-none text-gray-900">
                    {product.name}
                  </div>
                  {product.brand && (
                    <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-3 py-0.5 text-[20px] font-black leading-none text-[#0a1f44]">
                      <span className="text-base">🏷️</span>
                      <span className="truncate">{product.brand}</span>
                    </div>
                  )}
                </div>

                {barcodeDataUrl && (
                  <div className="mt-0.5 border-t border-dashed border-gray-300 pt-1 text-center">
                    <img
                      src={barcodeDataUrl}
                      alt="barcode"
                      className="mx-auto block h-auto w-full"
                    />
                  </div>
                )}
              </div>

              <div className="aspect-square w-[30%] shrink-0 self-center overflow-hidden rounded-lg bg-gray-50">
                {product.imageUrls[0] ? (
                  <img
                    src={product.imageUrls[0]}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300">
                    📦
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-gray-700">
              الإجراءات
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handlePrint}
                disabled={!qrDataUrl || qrGenerating}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
              >
                {qrGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                طباعة البطاقة
              </button>
              <button
                onClick={handleDownloadQR}
                disabled={!qrDataUrl || qrGenerating}
                className="flex items-center justify-center gap-2 rounded-lg border-2 border-[#ff5c00] bg-white py-3 text-sm font-bold text-[#ff5c00] transition hover:bg-[#fff4ed] disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                تحميل QR
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-700">
                رابط المنتج
              </h3>
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={loading}
                className="flex items-center gap-1 rounded-lg bg-[#fff4ed] px-2.5 py-1 text-[11px] font-bold text-[#ff5c00] transition hover:bg-[#ffe4d3] disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
                />
                تحديث
              </button>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <span
                className="block truncate font-mono text-[11px] text-gray-700"
                dir="ltr"
              >
                {productUrl}
              </span>
            </div>
            <p className="mt-2 text-[10px] text-gray-400">
              كود المنتج: <strong>{product.productCode}</strong>
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h3 className="mb-2 text-sm font-black text-blue-900">
              💡 كيف تستخدم البطاقة؟
            </h3>
            <ol className="space-y-1.5 text-xs text-blue-800">
              <li>1. اطبع البطاقة والصقها على المنتج في محلك</li>
              <li>2. عندما يمسح العميل الرمز → تظهر له تفاصيل المنتج</li>
              <li>3. يرى السعر واللون والمقاس والخيارات المتوفرة</li>
              <li>4. يمكنه طلبه مباشرة</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}