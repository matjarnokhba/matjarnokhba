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

type PrintLayoutId = "6" | "9" | "12" | "20" | "30" | "42" | "63" | "90" | "110";

const PRINT_LAYOUTS: Array<{
  id: PrintLayoutId;
  cols: number;
  rows: number;
  tickets: number;
  label: string;
}> = [
  { id: "6",   cols: 2, rows: 3,  tickets: 6,   label: "كبير جداً" },
  { id: "9",   cols: 3, rows: 3,  tickets: 9,   label: "كبير" },
  { id: "12",  cols: 3, rows: 4,  tickets: 12,  label: "متوسط ⭐" },
  { id: "20",  cols: 4, rows: 5,  tickets: 20,  label: "متوسط" },
  { id: "30",  cols: 5, rows: 6,  tickets: 30,  label: "صغير" },
  { id: "42",  cols: 6, rows: 7,  tickets: 42,  label: "صغير" },
  { id: "63",  cols: 7, rows: 9,  tickets: 63,  label: "صغير جداً" },
  { id: "90",  cols: 9, rows: 10, tickets: 90,  label: "ملصقات ⭐" },
  { id: "110", cols: 10, rows: 11, tickets: 110, label: "QR فقط" },
];
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
  const [printLayout, setPrintLayout] = useState<PrintLayoutId>("12");
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
            width: 600,
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
    const layout = PRINT_LAYOUTS.find((l) => l.id === printLayout);
    if (!layout) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const mainImage = product.imageUrls[0] || "";

    const ticketHTML = `<div class="ticket">
<div class="ticket-header">${seller.storeName}</div>
<div class="ticket-body">
<div class="qr-box"><img src="${qrDataUrl}" alt="QR"/></div>
<div class="img-box">${mainImage ? `<img src="${mainImage}" alt=""/>` : `<span class="ph">📦</span>`}</div>
</div>
<div class="ticket-name-section">
<div class="ticket-name">${product.name}</div>
${product.brand ? `<div class="ticket-brand">🏷️ ${product.brand}</div>` : ""}
</div>
${barcodeDataUrl ? `<div class="ticket-barcode-section"><img src="${barcodeDataUrl}" alt="barcode"/></div>` : ""}
<div class="ticket-footer"><span>📱</span><span>امسح رمز QR للمزيد من التفاصيل</span></div>
</div>`;

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><title>Print — ${product.name}</title><style>
@page { size: A4 portrait; margin: 5mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 200mm; min-height: 287mm; font-family: 'Segoe UI', Tahoma, sans-serif; background: #fff; }
#measure { position: fixed; top: -10000px; left: 0; width: 340px; overflow: hidden; }
#grid { display: flex; flex-direction: column; width: 200mm; }
.row { display: flex; justify-content: center; gap: 1mm; margin-bottom: 1mm; }
.row:last-child { margin-bottom: 0; }
.cell { overflow: hidden; border: 0.15mm dashed #999; flex-shrink: 0; }
.ticket { width: 100%; height: 100%; display: flex; flex-direction: column; background: #fff; line-height: 1.2; border: 0.4mm solid #0a1f44; border-radius: 1.5mm; overflow: hidden; }
.ticket-header { flex: 0 0 auto; background: #0a1f44; color: #fff; text-align: center; padding: 0.55em 0.67em; font-size: 1em; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ticket-body { display: flex; gap: 0.44em; padding: 0.44em; background: #f9fafb; border-bottom: 0.11em dashed #cbd5e1; }
.qr-box, .img-box { flex: 1 1 0; min-width: 0; aspect-ratio: 1; border: 0.11em solid #0a1f44; border-radius: 0.44em; overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center; }
.qr-box img, .img-box img { width: 100%; height: 100%; object-fit: cover; }
.qr-box img { object-fit: contain; padding: 0.22em; }
.ph { font-size: 2.22em; color: #cbd5e1; }
.ticket-name-section { text-align: center; padding: 0.55em 0.44em; background: #fff; }
.ticket-name { font-size: 1.11em; font-weight: 900; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ticket-brand { display: inline-block; background: #ff5c00; color: #fff; font-size: 0.67em; font-weight: 800; padding: 0.11em 0.55em; border-radius: 1.11em; margin-top: 0.22em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.ticket-barcode-section { background: #fff; padding: 0.33em 0.44em; text-align: center; border-top: 0.06em dashed #cbd5e1; }
.ticket-barcode-section img { width: 100%; max-height: 2.78em; display: block; margin: 0 auto; object-fit: contain; }
.ticket-footer { background: #0a1f44; color: #fff; text-align: center; padding: 0.33em 0.44em; font-size: 0.61em; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 0.22em; }
</style></head><body>
<div id="measure">${ticketHTML}</div>
<div id="grid"></div>
<script>
(function() {
  var TARGET = ${layout.tickets};
  var PAPER_W = 200;
  var PAPER_H = 287;
  var GAP_MM = 1;

  function buildGrid(N, paperW, paperH, ratio, gap) {
    var best = null;
    var maxCols = Math.min(N, 12);
    for (var M = 1; M <= maxCols; M++) {
      var K = Math.ceil(N / M);
      var cw = (paperW - (M - 1) * gap) / M;
      var ch = (paperH - (K - 1) * gap) / K;
      var tw, th;
      if (cw / ch > ratio) { th = ch; tw = th * ratio; }
      else { tw = cw; th = tw / ratio; }
      var area = tw * th;
      if (!best || area > best.area) best = { M: M, K: K, tw: tw, th: th, area: area };
    }
    return best;
  }

  function render() {
    var meas = document.querySelector('#measure .ticket');
    if (!meas) return;
    var refW = meas.offsetWidth;
    var refH = meas.offsetHeight;
    if (!refW || !refH) return;
    var ratio = refW / refH;

    var best = buildGrid(TARGET, PAPER_W, PAPER_H, ratio, GAP_MM);
    if (!best) return;

    var grid = document.querySelector('#grid');
    var idx = 0;
    for (var r = 0; r < best.K; r++) {
      var row = document.createElement('div');
      row.className = 'row';
      var itemsInRow = Math.min(best.M, TARGET - idx);
      for (var c = 0; c < itemsInRow; c++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.width = best.tw + 'mm';
        cell.style.height = best.th + 'mm';
        cell.style.fontSize = (best.tw * 0.0529) + 'mm';
        cell.innerHTML = '<div class="ticket">' + meas.innerHTML + '</div>';
        row.appendChild(cell);
        idx++;
      }
      grid.appendChild(row);
    }
  }

  function waitReady() {
    return Promise.all([
      (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve(),
      Promise.all(Array.from(document.images).map(function(img) {
        return img.complete ? Promise.resolve() : new Promise(function(res) { img.onload = res; img.onerror = res; });
      }))
    ]);
  }

  window.addEventListener('load', function() {
    waitReady().then(function() {
      requestAnimationFrame(function() {
        render();
        requestAnimationFrame(function() {
          setTimeout(function() { window.print(); }, 300);
        });
      });
    });
  });
})();
</script></body></html>`;
    win.document.write(html);
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
      <div className="overflow-x-hidden p-3 pt-14 sm:p-4 sm:pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-xl bg-red-50 p-8 text-center text-red-700">
          {error || "حدث خطأ"}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden p-3 pt-14 sm:p-4 sm:pt-16 lg:p-8 lg:pt-8">
      <canvas ref={qrCanvasRef} style={{ display: "none" }} />
      <svg ref={barcodeRef} style={{ display: "none" }} />

      <Link
        href={`/seller/products/${productId}`}
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للمنتج
      </Link>

      <div className="mb-4 sm:mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <QrCode className="h-6 w-6 text-[#ff5c00]" />
          بطاقة المنتج (QR Ticket)
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          اطبع هذه البطاقة والصقها على المنتج في محلك.
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <div className="w-full min-w-0">
          
          {/* ═══ المعاينة على الشاشة ═══ */}
          <div className="mx-auto flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border-2 border-[#0a1f44] bg-white shadow-lg sm:max-w-[340px]">
            <div className="bg-[#0a1f44] text-white text-center py-2 px-3 text-lg font-black">
              {seller.storeName}
            </div>
            
            <div className="flex min-w-0 gap-2 border-b-2 border-dashed border-gray-300 bg-gray-50 p-2">
              <div className="flex aspect-square min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg border-2 border-[#0a1f44] bg-white p-1">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR" className="w-full h-full object-contain" />
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin text-[#ff5c00]" />
                )}
              </div>
              <div className="flex aspect-square min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg border-2 border-[#0a1f44] bg-white">
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
                <img src={barcodeDataUrl} alt="barcode" className="mx-auto block max-h-[40px] w-full object-contain sm:max-h-[50px]" />
              </div>
            )}

            <div className="bg-[#0a1f44] text-white text-center py-1.5 px-2 text-[11px] font-bold flex items-center justify-center gap-1">
              <span>📱</span>
              <span>امسح رمز QR للمزيد من التفاصيل</span>
            </div>
          </div>
          {/* ═══ نهاية المعاينة ═══ */}

        </div>

        <div className="space-y-3 sm:space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-3 text-sm font-black text-gray-700">حجم الورقة والكمية</h3>
            <p className="mb-3 text-[11px] text-gray-500">
              اختر عدد التيكيتات لكل ورقة A4. الأصغر = أكثر في الورقة، لكن تفاصيل أقل.
            </p>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">
              {PRINT_LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setPrintLayout(l.id)}
                  disabled={!qrDataUrl || qrGenerating}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border-2 p-2 transition disabled:opacity-40 ${
                    printLayout === l.id
                      ? "border-[#ff5c00] bg-[#fff4ed]"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <span className={`text-base font-black ${printLayout === l.id ? "text-[#ff5c00]" : "text-gray-700"}`}>
                    {l.tickets}
                  </span>
                  <span className="text-[9px] font-bold text-gray-600">{l.label}</span>
                  <span className="text-[8px] text-gray-400" dir="ltr">{l.cols}×{l.rows}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-3 text-sm font-black text-gray-700">الإجراءات</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handlePrint}
                disabled={!qrDataUrl || qrGenerating}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
              >
                {qrGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                طباعة {PRINT_LAYOUTS.find((l) => l.id === printLayout)?.tickets || 4} تيكيت
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

          <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
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