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
  barcode?: string | null;
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

  useEffect(() => {
    if (loading || !product || !seller || !productUrl) return;
    if (qrDataUrl || barcodeDataUrl) return;

    const currentProduct = product;
    const currentProductUrl = productUrl;

    async function generate() {
      setQrGenerating(true);
      try {
        if (qrCanvasRef.current) {
          await QRCode.toCanvas(qrCanvasRef.current, currentProductUrl, {
            width: 800,
            margin: 0, // تقليل الهوامش
            color: { dark: "#0a1f44", light: "#ffffff" },
            errorCorrectionLevel: "H",
          });
          setQrDataUrl(qrCanvasRef.current.toDataURL("image/png"));
        }

        const codeToPrint = currentProduct.barcode || `NOKHBA-${currentProduct.id}`;
        
        if (barcodeRef.current) {
          JsBarcode(barcodeRef.current, codeToPrint, {
            format: "CODE128",
            width: 1.5,
            height: 35,
            displayValue: true,
            fontSize: 12,
            font: "monospace",
            textMargin: 2,
            margin: 0,
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

    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>Ticket — ${product.name}</title>
        <style>
          @page { margin: 0; } /* إزالة هوامش المتصفح */
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, sans-serif;
            background: #f3f4f6;
            padding: 20px;
            display: flex;
            justify-content: center; /* توسيط أفقي فقط */
            align-items: flex-start; /* منع التوسيط العمودي الذي يسبب الفراغات */
            min-height: auto;
          }
          .ticket {
            width: 340px;
            background: #fff;
            border-radius: 12px;
            overflow: hidden;
            border: 2px solid #0a1f44;
          }
          .ticket-header {
            background: #0a1f44;
            color: #fff;
            text-align: center;
            padding: 8px;
            font-size: 18px;
            font-weight: 900;
          }
          .ticket-body {
            display: flex;
            padding: 8px;
            gap: 8px;
            background: #f9fafb;
            border-bottom: 2px dashed #cbd5e1;
          }
          .qr-container, .image-container {
            width: 50%;
            aspect-ratio: 1 / 1;
            background: #fff;
            border: 2px solid #0a1f44;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }
          .qr-container img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }
          .image-container img { width: 100%; height: 100%; object-fit: cover; }
          .image-placeholder { font-size: 40px; color: #cbd5e1; }
          
          .product-info { text-align: center; padding: 10px 8px; background: #fff; }
          .product-name { font-size: 20px; font-weight: 900; color: #111827; line-height: 1.2; }
          .brand-badge { display: inline-block; background: #ff5c00; color: #fff; font-size: 12px; font-weight: 800; padding: 2px 10px; border-radius: 20px; margin-top: 4px; }
          
          .barcode-section {
            background: #fff;
            padding: 6px 8px;
            text-align: center;
            border-top: 1px dashed #cbd5e1;
          }
          .barcode-section img { width: 100%; max-height: 50px; display: block; margin: 0 auto; }
          
          .ticket-footer {
            background: #0a1f44;
            color: #fff;
            text-align: center;
            padding: 6px;
            font-size: 11px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
          }
          
          @media print {
            body { background: #fff; padding: 0; display: block; } /* إزالة التوسيط عند الطباعة */
            .ticket { box-shadow: none; margin: 0 auto; page-break-inside: avoid; } /* في أعلى الصفحة بدون فراغات */
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="ticket-header">${seller.storeName}</div>
          <div class="ticket-body">
            <div class="qr-container"><img src="${qrDataUrl}" alt="QR" /></div>
            <div class="image-container">${mainImage ? `<img src="${mainImage}" alt="" />` : `<span class="image-placeholder">📦</span>`}</div>
          </div>
          <div class="product-info">
            <div class="product-name">${product.name}</div>
            ${product.brand ? `<div class="brand-badge">🏷️ ${product.brand}</div>` : ''}
          </div>
          ${barcodeDataUrl ? `<div class="barcode-section"><img src="${barcodeDataUrl}" alt="barcode" /></div>` : ''}
          <div class="ticket-footer"><span>📱</span><span>امسح رمز QR للمزيد من التفاصيل</span></div>
        </div>
        <script>window.onload = () => { setTimeout(() => { window.print(); }, 500); };</script>
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

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex justify-center">
          
          {/* ═══ المعاينة على الشاشة ═══ */}
          <div className="w-full max-w-[340px] overflow-hidden rounded-xl border-2 border-[#0a1f44] bg-white shadow-lg flex flex-col">
            <div className="bg-[#0a1f44] text-white text-center py-2 px-3 text-lg font-black">
              {seller.storeName}
            </div>
            
            <div className="flex p-2 gap-2 bg-gray-50 border-b-2 border-dashed border-gray-300">
              <div className="w-1/2 aspect-square bg-white border-2 border-[#0a1f44] rounded-lg p-1 flex items-center justify-center overflow-hidden">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR" className="w-full h-full object-contain" />
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin text-[#ff5c00]" />
                )}
              </div>
              <div className="w-1/2 aspect-square bg-white border-2 border-[#0a1f44] rounded-lg overflow-hidden flex items-center justify-center">
                {product.imageUrls[0] ? (
                  <img src={product.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl text-gray-300">📦</span>
                )}
              </div>
            </div>

            <div className="text-center py-2.5 px-2 bg-white">
              <div className="text-xl font-black text-gray-900 leading-tight">{product.name}</div>
              {product.brand && (
                <div className="inline-block bg-[#ff5c00] text-white text-xs font-bold px-2.5 py-0.5 rounded-full mt-1">
                  🏷️ {product.brand}
                </div>
              )}
            </div>

            {barcodeDataUrl && (
              <div className="bg-white py-1.5 px-2 text-center border-t border-dashed border-gray-300">
                <img src={barcodeDataUrl} alt="barcode" className="w-full max-h-[50px] mx-auto block" />
              </div>
            )}

            <div className="bg-[#0a1f44] text-white text-center py-1.5 px-2 text-[11px] font-bold flex items-center justify-center gap-1">
              <span>📱</span>
              <span>امسح رمز QR للمزيد من التفاصيل</span>
            </div>
          </div>
          {/* ═══ نهاية المعاينة ═══ */}

        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-gray-700">الإجراءات</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handlePrint}
                disabled={!qrDataUrl || qrGenerating}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
              >
                {qrGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                طباعة
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
              <h3 className="text-sm font-black text-gray-700">رابط المنتج</h3>
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={loading}
                className="flex items-center gap-1 rounded-lg bg-[#fff4ed] px-2.5 py-1 text-[11px] font-bold text-[#ff5c00] transition hover:bg-[#ffe4d3] disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                تحديث
              </button>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <span className="block truncate font-mono text-[11px] text-gray-700" dir="ltr">
                {productUrl}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}