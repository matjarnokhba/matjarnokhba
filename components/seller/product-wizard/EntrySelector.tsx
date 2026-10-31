"use client";

import { useState } from "react";
import { Scan, PenLine, Loader2, ArrowLeft, Search, CheckCircle2, AlertCircle } from "lucide-react";
import type { ProductFormData } from "./types";

type Props = {
  onChoose: (mode: "scan" | "manual", data?: Partial<ProductFormData>) => void;
};

export default function EntrySelector({ onChoose }: Props) {
  const [mode, setMode] = useState<"choose" | "scan">("choose");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLookup() {
    const trimmed = code.trim();
    if (!trimmed) { setError("أدخل الباركود أو الرمز"); return; }
    if (trimmed.length < 3) { setError("الرمز قصير جدًا (3 أحرف على الأقل)"); return; }

    setLoading(true); setError("");
    try {
      const res = await fetch("/api/products/master/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed, codeType: "BARCODE" }),
      });
      const data = await res.json();

      if (data.success && data.master) {
        const m = data.master;
        onChoose("scan", {
          categoryId: m.category?.id ?? null,
          categoryName: m.category?.name ?? "",
          categorySlug: m.category?.slug ?? "",
          name: m.name ?? "",
          brand: m.brand ?? "",
          description: m.description ?? "",
          imageUrls: Array.isArray(m.images) ? m.images : [],
          barcode: m.barcode ?? trimmed,
        });
        return;
      }

      onChoose("scan", { barcode: trimmed });
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "scan") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm" dir="rtl">
        <button
          type="button"
          onClick={() => setMode("choose")}
          className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]"
        >
          <ArrowLeft className="h-3.5 w-3.5 rotate-180" /> رجوع
        </button>

        <h2 className="mb-1 text-lg font-black text-gray-900">مسح أو إدخال الباركود</h2>
        <p className="mb-4 text-xs text-gray-500">
          أدخل رقم الباركود أو QR. إن كان المنتج موجودًا، ستُملأ بياناته تلقائيًا.
        </p>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              placeholder="مثال: 6111234567890 أو ABC-XYZ"
              dir="ltr"
              autoFocus
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleLookup}
            disabled={loading || !code.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white hover:bg-[#e64a00] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? "جارٍ البحث..." : "بحث"}
          </button>

          <button
            type="button"
            onClick={() => onChoose("scan", { barcode: code.trim() })}
            className="block w-full rounded-lg border border-gray-200 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
          >
            تخطي البحث — إدخال يدوي مع هذا الباركود
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl" dir="rtl">
      <h2 className="mb-2 text-center text-xl font-black text-gray-900">
        كيف تريد إضافة منتجك؟
      </h2>
      <p className="mb-6 text-center text-sm text-gray-500">
        ابدأ بمسح الباركود للتعبئة التلقائية، أو أدخل كل التفاصيل يدويًا
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("scan")}
          className="group rounded-2xl border-2 border-gray-200 bg-white p-6 text-right transition hover:border-[#ff5c00] hover:shadow-md"
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#fff4ed]">
            <Scan className="h-6 w-6 text-[#ff5c00]" />
          </span>
          <h3 className="mt-3 font-black text-gray-900">عندي باركود / QR</h3>
          <p className="mt-1 text-xs text-gray-500">
            أدخل الرمز → إن كان المنتج موجودًا، تُملأ البيانات تلقائيًا
          </p>
          <span className="mt-3 inline-block text-xs font-bold text-[#ff5c00] group-hover:underline">
            ابدأ بمسح ←
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChoose("manual")}
          className="group rounded-2xl border-2 border-gray-200 bg-white p-6 text-right transition hover:border-[#ff5c00] hover:shadow-md"
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
            <PenLine className="h-6 w-6 text-blue-600" />
          </span>
          <h3 className="mt-3 font-black text-gray-900">منتج جديد (بلا باركود)</h3>
          <p className="mt-1 text-xs text-gray-500">
            أدخل كل التفاصيل → يولَّد الباركود و QR تلقائيًا
          </p>
          <span className="mt-3 inline-block text-xs font-bold text-blue-600 group-hover:underline">
            إدخال يدوي ←
          </span>
        </button>
      </div>

      <div className="mt-6 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
        <CheckCircle2 className="mb-1 inline h-3.5 w-3.5" />{" "}
        <strong>ملاحظة:</strong> لو اخترت "عندي باركود" ولم يُعثر على المنتج، يمكنك إدخال باقي التفاصيل يدويًا وسيبقى الباركود الذي أدخلته.
      </div>
    </div>
  );
}