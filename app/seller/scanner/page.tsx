"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Scan,
  ShoppingBag,
  Truck,
  X,
  Loader2,
  AlertCircle,
  Check,
  CheckCircle2,
  Package,
  ArrowRight,
  Printer,
  Trash2,
  Plus,
  Minus,
  Edit3,
} from "lucide-react";

type Variant = {
  id: number;
  sku: string;
  barcode: string | null;
  price: number;
  storePrice: number;
  oldPrice: number | null;
  stock: number;
  available: number;
  isDefault: boolean;
  optionValueIds: number[];
  optionValueLabels: string[];
};

type ScannedProduct = {
  id: number;
  productCode: string;
  name: string;
  image: string | null;
  price: number;
  storePrice: number;
  variants: Variant[];
};

type CartLine = {
  variantId: number;
  productId: number;
  productName: string;
  variantLabel: string;
  image: string | null;
  price: number;
  quantity: number;
  available: number;
  barcode: string | null;
};

function ScannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const orderNumber = searchParams.get("orderNumber");
  const itemsCount = searchParams.get("itemsCount");
  const total = searchParams.get("total");

  const orderSummary = orderId && orderNumber ? {
    id: orderId,
    orderNumber,
    itemsCount: Number(itemsCount || 0),
    total: Number(total || 0),
  } : null;

  const [mode, setMode] = useState<"product" | "order">("product");
  const [posStep, setPosStep] = useState<"scan" | "review" | "success">("scan");
  
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  
  // POS State
  const [products, setProducts] = useState<ScannedProduct[]>([]);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successSale, setSuccessSale] = useState<{ id: number; receiptNumber: string; total: number } | null>(null);

  // Order Mode State
  const [orderResult, setOrderResult] = useState<any>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanTimeRef = useRef<number>(0); // لحفظ وقت آخر عملية مسح
  const scannerDivId = "qr-reader";

  // ═══════════════════════════════════════════
  // SCANNER CONTROLS (Updated for explicit Barcode support)
  // ═══════════════════════════════════════════
  // ═══ دالة للتحقق من صحة الباركود (لمنع القراءات الخاطئة) ═══
  function isValidEAN13(code: string) {
    if (!/^\d{13}$/.test(code)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(code[12]);
  }

  async function startScanner() {
    setScanError("");
    setScanning(true);

    setTimeout(async () => {
      try {
        scannerRef.current = new Html5Qrcode(scannerDivId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            // تمت إزالة CODE_128 لتجنب التقاط الأرقام التسلسلية داخل المنتجات
          ],
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });

        await scannerRef.current.start(
          { facingMode: "environment" },
          { 
            fps: 30, // 30 إطار في الثانية (سرعة فائقة)
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              return {
                width: Math.floor(viewfinderWidth * 0.95), // إطار يغطي الشاشة
                height: Math.floor(viewfinderHeight * 0.5) // مستطيل ممتاز للباركود
              };
            }
          },
          (decodedText) => {
            const now = Date.now();
            if (now - lastScanTimeRef.current < 1500) return;

            // التحقق من صحة الباركود (إذا كان 13 رقماً، يجب أن يكون باركود حقيقي)
            if (decodedText.length < 6) return;
            if (decodedText.length === 13 && !isValidEAN13(decodedText)) return;

            lastScanTimeRef.current = now;

            // تشغيل صوت واهتزاز
            try {
              if (navigator.vibrate) navigator.vibrate(100);
              
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(800, ctx.currentTime);
              gain.gain.setValueAtTime(0.1, ctx.currentTime);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.1);
            } catch(e) {}

            handleScan(decodedText);
          },
          () => {}
        );

        // ═══ الحل العبقري: تفعيل التركيز التلقائي المستمر للكاميرا ═══
        setTimeout(() => {
          const video = document.querySelector(`#${scannerDivId} video`) as HTMLVideoElement;
          if (video && video.srcObject) {
            const track = (video.srcObject as MediaStream).getVideoTracks()[0];
            if (track) {
              const capabilities = track.getCapabilities() as any;
              if (capabilities.focusMode && capabilities.focusMode.includes("continuous")) {
                track.applyConstraints({
                  advanced: [{ focusMode: "continuous" } as any]
                }).catch(e => console.log("Focus error", e));
              }
            }
          }
        }, 1000);

      } catch (err) {
        console.error(err);
        setScanError("تعذر فتح الكاميرا. تأكد من إعطاء المتصفح صلاحية الكاميرا.");
        setScanning(false);
      }
    }, 300);
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

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  // ═══════════════════════════════════════════
  // SCAN HANDLER
  // ═══════════════════════════════════════════
  async function handleScan(text: string) {
    if (loading) return; // منع المسح المتكرر
    
    let code = text.trim();
    if (code.includes("/p/")) {
      const match = code.match(/\/p\/([A-Za-z0-9_-]+)/);
      if (match) code = match[1];
    }

    if (mode === "product") {
      await loadByCode(code);
    } else {
      await handleOrderToken(code);
    }
  }

  // ═══════════════════════════════════════════
  // LOAD PRODUCT
  // ═══════════════════════════════════════════
  async function loadByCode(code: string) {
    setLoading(true);
    setScanError("");

    try {
      const res = await fetch(`/api/seller/products/by-code/${code}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        // إذا لم يجده في منتجات التاجر، نبحث عنه في قاعدة نخبة أو الإنترنت
        if (res.status === 404) {
          await stopScanner();
          
          // جلب البيانات من الـ API الجديد
          const lookupRes = await fetch(`/api/products/lookup?code=${encodeURIComponent(code)}`);
          const lookupData = await lookupRes.json();

          let url = `/seller/products/new?barcode=${encodeURIComponent(code)}`;
          
          if (lookupData.success) {
            const info = lookupData.data;
            url += `&name=${encodeURIComponent(info.name)}`;
            url += `&brand=${encodeURIComponent(info.brand)}`;
            if (info.image) url += `&image=${encodeURIComponent(info.image)}`;
            if (info.categoryId) url += `&category=${info.categoryId}`;
          }
          
          router.push(url);
          return;
        }
        
        setScanError(data.message || "حدث خطأ أثناء جلب المنتج");
        return;
      }

      const product: ScannedProduct = data.product;

      if (!product.variants || product.variants.length === 0) {
        setScanError(`⚠️ المنتج "${product.name}" لا يحتوي على أي variant نشط.`);
        return;
      }

      setProducts((prev) => {
        const exists = prev.some((p) => p.id === product.id);
        return exists ? prev : [...prev, product];
      });

      const matchedVariant = product.variants.find(v => v.barcode === code) || product.variants.find((v) => v.isDefault) || product.variants[0];
      addLine(product, matchedVariant);

    } catch (err) {
      console.error(err);
      setScanError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  function addLine(product: ScannedProduct, variant: Variant) {
    const label = variant.optionValueLabels.join(" / ");

    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id);
      if (existing) {
        const max = existing.available;
        return prev.map((l) =>
          l.variantId === variant.id
            ? { ...l, quantity: Math.min(l.quantity + 1, max) }
            : l
        );
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          productId: product.id,
          productName: product.name,
          variantLabel: label,
          image: product.image,
          price: variant.storePrice,
          quantity: 1,
          available: variant.available,
          barcode: variant.barcode,
        },
      ];
    });
  }

  function updateQty(variantId: number, delta: number) {
    setLines((prev) =>
      prev.flatMap((l) => {
        if (l.variantId !== variantId) return [l];
        const q = l.quantity + delta;
        if (q <= 0) return [];
        return [{ ...l, quantity: Math.min(q, l.available) }];
      })
    );
  }

  function updatePrice(variantId: number, newPrice: number) {
    setLines((prev) =>
      prev.map((l) =>
        l.variantId === variantId ? { ...l, price: Math.max(0, newPrice) } : l
      )
    );
  }

  function removeLine(variantId: number) {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  const cartTotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);

  // ═══════════════════════════════════════════
  // SUBMIT POS SALE
  // ═══════════════════════════════════════════
  async function submitPosSale() {
    if (lines.length === 0) return;
    setSubmitting(true);
    setScanError("");

    try {
      const res = await fetch("/api/seller/store-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({
            variantId: l.variantId,
            quantity: l.quantity,
            unitPrice: l.price,
          })),
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          note: note.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setScanError(data.message || "فشل إنشاء الفاتورة");
        return;
      }

      setSuccessSale(data.sale);
      setPosStep("success");
      setLines([]);
      setProducts([]);
      setCustomerName("");
      setCustomerPhone("");
      setNote("");
    } catch {
      setScanError("فشل الاتصال بالخادم");
    } finally {
      setSubmitting(false);
    }
  }

  // ═══════════════════════════════════════════
  // ORDER MODE (Legacy Ready logic)
  // ═══════════════════════════════════════════
  async function handleOrderToken(rawToken: string) {
    if (loading) return;
    let token = rawToken.trim();
    if (token.includes("/d/")) {
      const match = token.match(/\/d\/([A-Za-z0-9_-]+)/);
      if (match) token = match[1];
    } else if (token.includes("/r/") || token.includes("/p/") || token.includes("/sd/") || token.includes("/cb/")) {
      setOrderResult({ status: "error", message: "هذا الرمز ليس طلبية." });
      return;
    }

    if (!token || token.length < 20) {
      setOrderResult({ status: "error", message: "رمز غير صحيح" });
      return;
    }

    setLoading(true);
    setScanError("");

    try {
      const res = await fetch(`/api/seller/orders/by-token/${encodeURIComponent(token)}/ready`, { method: "POST" });
      const rawText = await res.text();
      let data: any = null;
      if (rawText.trim().length > 0) {
        try { data = JSON.parse(rawText); } catch { data = null; }
      }

      if (!res.ok || !data || !data.success) {
        setOrderResult({ status: "error", message: data?.message || `فشل (${res.status})` });
        return;
      }

      if (data.alreadyReady) {
        setOrderResult({ status: "already_ready", orderNumber: data.orderNumber, orderId: data.orderId });
      } else {
        setOrderResult({ status: "success", orderNumber: data.orderNumber, orderId: data.orderId });
      }
    } catch {
      setOrderResult({ status: "error", message: "فشل الاتصال بالخادم" });
    } finally {
      setLoading(false);
    }
  }

  // ═══════════════════════════════════════════
  // RENDER: SUCCESS POS
  // ═══════════════════════════════════════════
  if (posStep === "success" && successSale) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <Check className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="mt-5 text-2xl font-black">تمت عملية البيع!</h1>
          <p className="mt-2 text-sm text-gray-500">
            رقم الفاتورة: <strong className="font-mono text-[#ff5c00]">{successSale.receiptNumber}</strong>
          </p>
          <p className="mt-1 text-lg font-black text-[#ff5c00]">{successSale.total.toFixed(2)} د.م</p>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => window.open(`/seller/pos-invoice/${successSale.id}?print=1`, "_blank")}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#0a1f44] py-3 text-sm font-bold text-white transition hover:bg-[#1a2f54]"
            >
              <Printer className="h-4 w-4" />
              طباعة الفاتورة
            </button>
            <button
              onClick={() => { setSuccessSale(null); setPosStep("scan"); }}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
            >
              <Scan className="h-4 w-4" />
              عملية بيع جديدة
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // RENDER: REVIEW POS
  // ═══════════════════════════════════════════
  if (posStep === "review") {
    return (
      <div className="p-4 pt-16 pb-24 lg:p-8 lg:pt-8">
        <div className="mx-auto max-w-2xl">
          <button onClick={() => setPosStep("scan")} className="mb-4 flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-gray-900">
            <ArrowRight className="h-4 w-4" /> العودة للماسح
          </button>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h1 className="mb-6 text-xl font-black">مراجعة الفاتورة</h1>

            <div className="space-y-4 mb-6">
              {lines.map((l) => (
                <div key={l.variantId} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 p-3">
                  {l.image && <img src={l.image} alt={l.productName} className="h-12 w-12 rounded object-cover" />}
                  <div className="flex-1 min-w-[150px]">
                    <div className="text-sm font-bold">{l.productName}</div>
                    <div className="text-xs text-gray-500">{l.variantLabel}</div>
                  </div>
                  
                  <div className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1">
                    <Edit3 className="h-3 w-3 text-gray-400" />
                    <input 
                      type="number" 
                      value={l.price} 
                      onChange={(e) => updatePrice(l.variantId, Number(e.target.value))}
                      className="w-16 text-center text-sm font-bold outline-none"
                    />
                    <span className="text-[10px] text-gray-500">د.م</span>
                  </div>

                  <div className="flex items-center overflow-hidden rounded-lg border border-gray-200">
                    <button onClick={() => updateQty(l.variantId, -1)} className="h-8 w-8 bg-gray-50 hover:bg-gray-100"><Minus className="h-3 w-3 mx-auto" /></button>
                    <span className="min-w-[2rem] text-center text-sm font-bold">{l.quantity}</span>
                    <button onClick={() => updateQty(l.variantId, 1)} disabled={l.quantity >= l.available} className="h-8 w-8 bg-gray-50 hover:bg-gray-100 disabled:opacity-30"><Plus className="h-3 w-3 mx-auto" /></button>
                  </div>

                  <button onClick={() => removeLine(l.variantId)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-200 pt-4 mb-6">
              <div className="flex justify-between text-lg font-black">
                <span>الإجمالي</span>
                <span className="text-[#ff5c00]">{cartTotal.toFixed(2)} د.م</span>
              </div>
            </div>

            <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-xl">
              <input type="text" placeholder="اسم العميل (اختياري)" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" />
              <input type="tel" placeholder="رقم الهاتف (اختياري)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" />
            </div>

            {scanError && <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{scanError}</div>}

            <button onClick={submitPosSale} disabled={submitting} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#ff5c00] py-4 text-base font-bold text-white shadow-lg transition hover:bg-[#e64a00] disabled:opacity-50">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              تأكيد البيع ({cartTotal.toFixed(2)} د.م)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // RENDER: MAIN SCANNER (POS + ORDER)
  // ═══════════════════════════════════════════
  return (
    <div className="p-4 pt-16 pb-24 lg:p-8 lg:pt-8 relative min-h-screen">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Scan className="h-6 w-6 text-[#ff5c00]" />
          الماسح
        </h1>
      </div>

      <div className="mb-5 flex gap-2 rounded-xl bg-gray-100 p-1">
        <button onClick={() => { setMode("product"); setScanError(""); setOrderResult(null); }} className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition ${mode === "product" ? "bg-white text-[#ff5c00] shadow-sm" : "text-gray-500"}`}>
          <ShoppingBag className="h-4 w-4" /> بيع في المتجر
        </button>
        <button onClick={() => { setMode("order"); setScanError(""); }} className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition ${mode === "order" ? "bg-white text-[#ff5c00] shadow-sm" : "text-gray-500"}`}>
          <Truck className="h-4 w-4" /> تجهيز طلب
        </button>
      </div>

      {/* ORDER MODE UI */}
      {mode === "order" && !orderResult && (
         <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-sm">
         {orderSummary && (
           <div className="mb-4 rounded-xl border-2 border-[#ff5c00] bg-[#fff4ed] p-4">
             <div className="text-xs font-bold text-gray-700">الطلب الذي ستُجهّزه</div>
             <div className="mt-1 flex items-center justify-between gap-3">
               <div>
                 <div className="font-mono text-lg font-black text-[#ff5c00]">{orderSummary.orderNumber}</div>
                 <div className="mt-0.5 text-[11px] text-gray-600">{orderSummary.itemsCount} منتج — {Number(orderSummary.total).toFixed(2)} د.م</div>
               </div>
               <Link href={`/seller/orders/${orderSummary.id}`} className="text-[11px] font-bold text-[#ff5c00] underline">عرض</Link>
             </div>
           </div>
         )}

         <div className="mb-5 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 p-4">
           <div className="flex items-start gap-3">
             <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100"><Truck className="h-5 w-5 text-purple-700" /></div>
             <div>
               <div className="text-sm font-black text-purple-900">امسح ملصق الطلبية</div>
               <p className="mt-1 text-xs text-purple-700">امسح QR الموجود على ملصق الطرد المطبوع لإبلاغ النظام بأنه جاهز للشحن.</p>
             </div>
           </div>
         </div>

         {!scanning ? (
           <button onClick={startScanner} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-3.5 text-sm font-bold text-white transition hover:bg-purple-700 disabled:opacity-50">
             <Scan className="h-5 w-5" /> فتح الكاميرا للمسح
           </button>
         ) : (
           <button onClick={stopScanner} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 py-3.5 text-sm font-bold text-red-600 transition hover:bg-red-100">
             <X className="h-5 w-5" /> إيقاف الماسح
           </button>
         )}

         {scanning && (
           <div className="mt-4 overflow-hidden rounded-xl">
             <div id={scannerDivId} className="w-full" />
             <p className="mt-3 text-center text-xs text-gray-500">وجّه الكاميرا نحو QR الملصق</p>
           </div>
         )}

         {!scanning && (
           <div className="mt-4 border-t border-gray-100 pt-4">
             <div className="mb-2 text-xs font-bold text-gray-700">أو إدخال يدوي للرمز</div>
             <form onSubmit={(e) => { e.preventDefault(); if (!manualCode.trim()) return; handleOrderToken(manualCode.trim()); setManualCode(""); }} className="flex gap-2">
               <input type="text" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="الصق رمز الطلبية..." dir="ltr" className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-purple-500 focus:bg-white" />
               <button type="submit" disabled={!manualCode.trim() || loading} className="rounded-lg bg-purple-600 px-4 text-xs font-bold text-white transition hover:bg-purple-700 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد"}</button>
             </form>
           </div>
         )}

         {scanError && <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{scanError}</span></div>}
       </div>
      )}

      {/* PRODUCT MODE UI (POS) */}
      {mode === "product" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-5 shadow-sm sticky top-20">
              {!scanning ? (
                <button onClick={startScanner} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3.5 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50">
                  <Scan className="h-5 w-5" /> فتح الكاميرا للمسح
                </button>
              ) : (
                <button onClick={stopScanner} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 py-3.5 text-sm font-bold text-red-600 transition hover:bg-red-100">
                  <X className="h-5 w-5" /> إيقاف الماسح
                </button>
              )}

              {scanning && (
                <div className="mt-4 overflow-hidden rounded-xl">
                  <div id={scannerDivId} className="w-full" />
                  <p className="mt-3 text-center text-xs text-gray-500">امسح الباركود أو QR للمنتج</p>
                </div>
              )}

              {!scanning && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="mb-2 text-xs font-bold text-gray-700">إدخال يدوي للكود</div>
                  <form onSubmit={(e) => { e.preventDefault(); if (!manualCode.trim()) return; loadByCode(manualCode.trim()); setManualCode(""); }} className="flex gap-2">
                    <input type="text" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="الصق الباركود..." dir="ltr" className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-[#ff5c00] focus:bg-white" />
                    <button type="submit" disabled={!manualCode.trim() || loading} className="rounded-lg bg-[#ff5c00] px-4 text-xs font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "جلب"}</button>
                  </form>
                </div>
              )}

              {scanError && <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{scanError}</span></div>}
            </div>
            
            {products.length > 0 && (
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-black text-gray-700">المنتجات الممسوحة ({products.length})</h3>
                <div className="space-y-2">
                  {products.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-lg border border-gray-100 p-2">
                      {p.image && <img src={p.image} alt={p.name} className="h-10 w-10 shrink-0 rounded object-cover" />}
                      <div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{p.name}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm pb-32">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-black"><ShoppingBag className="h-5 w-5 text-[#ff5c00]" /> السلة</h2>
              {lines.length > 0 && <span className="rounded-full bg-[#fff4ed] px-2 py-0.5 text-xs font-bold text-[#ff5c00]">{lines.length} منتج</span>}
            </div>

            {lines.length === 0 ? (
              <div className="py-12 text-center">
                <div className="text-5xl">📷</div>
                <p className="mt-3 text-sm font-bold text-gray-500">ابدأ بمسح المنتجات</p>
              </div>
            ) : (
              <>
                <div className="mb-4 max-h-[400px] space-y-3 overflow-y-auto">
                  {lines.map((l) => (
                    <div key={l.variantId} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-start gap-2">
                        {l.image && <img src={l.image} alt={l.productName} className="h-14 w-14 shrink-0 rounded object-cover" />}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold">{l.productName}</div>
                          {l.variantLabel && <div className="mt-0.5 text-[10px] text-gray-500">{l.variantLabel}</div>}
                          <div className="mt-1 text-xs font-black text-[#ff5c00]">{l.price.toFixed(2)} د.م</div>
                        </div>
                        <button onClick={() => removeLine(l.variantId)} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center overflow-hidden rounded-full border border-gray-200">
                          <button onClick={() => updateQty(l.variantId, -1)} className="flex h-6 w-6 items-center justify-center text-gray-500 hover:bg-gray-50"><Minus className="h-3 w-3" /></button>
                          <span className="min-w-[2rem] border-x border-gray-200 py-0.5 text-center text-xs font-bold">{l.quantity}</span>
                          <button onClick={() => updateQty(l.variantId, 1)} disabled={l.quantity >= l.available} className="flex h-6 w-6 items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30"><Plus className="h-3 w-3" /></button>
                        </div>
                        <span className="text-[10px] text-gray-400">متاح: {l.available}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <div className="mb-3 flex justify-between text-sm">
                    <span className="font-bold">الإجمالي</span>
                    <span className="text-lg font-black text-[#ff5c00]">{cartTotal.toFixed(2)} د.م</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {lines.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] lg:static lg:border-none lg:bg-transparent lg:p-0 lg:shadow-none lg:mt-4">
              <button onClick={() => setPosStep("review")} className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3.5 text-sm font-bold text-white transition hover:bg-[#e64a00]">
                <Check className="h-5 w-5" /> إتمام البيع · {cartTotal.toFixed(2)} د.م
              </button>
            </div>
          )}
        </div>
      )}

      {/* ORDER MODE RESULT */}
      {mode === "order" && orderResult && (
         <div className="mx-auto max-w-md mt-8">
         <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
           {orderResult.status === "success" && (
             <>
               <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100"><CheckCircle2 className="h-10 w-10 text-green-600" /></div>
               <h1 className="mt-5 text-2xl font-black text-green-700">الطرد جاهز!</h1>
               <p className="mt-2 text-sm text-gray-600">تم إبلاغ المستودع بأن الطلب جاهز للجمع.</p>
             </>
           )}
           {orderResult.status === "already_ready" && (
             <>
               <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100"><Package className="h-10 w-10 text-blue-600" /></div>
               <h1 className="mt-5 text-2xl font-black text-blue-700">جاهز للشحن</h1>
               <p className="mt-2 text-sm text-gray-600">هذا الطرد جاهز مسبقًا. بانتظار مسؤول الجمع.</p>
             </>
           )}
           {orderResult.status === "error" && (
             <>
               <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100"><AlertCircle className="h-10 w-10 text-red-600" /></div>
               <h1 className="mt-5 text-2xl font-black text-red-700">تعذّر التحديث</h1>
               <p className="mt-2 text-sm text-gray-600">{orderResult.message}</p>
             </>
           )}
           <div className="mt-6 flex flex-col gap-2">
             <button onClick={() => { setOrderResult(null); setScanError(""); }} className="flex items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"><Scan className="h-4 w-4" /> مسح طرد آخر</button>
           </div>
         </div>
       </div>
      )}
    </div>
  );
}

export default function SellerScannerPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" /></div>}>
      <ScannerContent />
    </Suspense>
  );
}