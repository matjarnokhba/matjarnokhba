"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, AlertCircle, PackagePlus, CheckCircle2 } from "lucide-react";
import DocumentUploader from "@/components/seller/DocumentUploader";

type Opt = { id: number; label: string; sku: string; stock: number; reserved: number; defective: number };

const SOURCES: { value: string; label: string }[] = [
  { value: "SUPPLIER", label: "شراء من مورد أو شركة" },
  { value: "FACTORY", label: "شراء من مصنع" },
  { value: "OTHER_STORE", label: "شراء من متجر آخر" },
  { value: "WHOLESALE_MARKET", label: "شراء من سوق الجملة" },
  { value: "BRANCH_TRANSFER", label: "تحويل من فرع آخر" },
  { value: "OTHER", label: "مصدر آخر" },
];

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#ff5c00]";

export default function AddStockPage() {
  const params = useParams();
  const productId = parseInt(params.id as string);

  const [name, setName] = useState("");
  const [options, setOptions] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isOwner, setIsOwner] = useState(false);

  const [qty, setQty] = useState<Record<number, string>>({});
  const [cost, setCost] = useState<Record<number, string>>({});
  const [sourceType, setSourceType] = useState("SUPPLIER");
  const [sourceName, setSourceName] = useState("");
  const [sourcePhone, setSourcePhone] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [invoice, setInvoice] = useState<{ url: string; name: string } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ status: string; added: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [res, me] = await Promise.all([
          fetch(`/api/seller/products/${productId}/stock-options`),
          fetch("/api/auth/me"),
        ]);
        const json = await res.json();
        if (!json.success) {
          setLoadError(json.message || "تعذر تحميل المنتج");
          return;
        }
        setName(json.product.name);
        setOptions(json.product.options);
        const meJson = me.ok ? await me.json() : null;
        setIsOwner(!!meJson?.user?.isSellerOwner);
      } catch {
        setLoadError("فشل الاتصال بالخادم");
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  const totalQty = options.reduce((s, o) => s + (Number(qty[o.id]) > 0 ? Number(qty[o.id]) : 0), 0);

  async function submit() {
    setError("");
    const items = options
      .map((o) => ({ o, q: qty[o.id] ? Number(qty[o.id]) : 0 }))
      .filter((x) => x.q > 0);
    if (items.length === 0) return setError("أدخل كمية لخيار واحد على الأقل");
    if (items.some((x) => !Number.isInteger(x.q))) return setError("الكمية يجب أن تكون عدداً صحيحاً");
    if (sourceType === "OTHER" && !sourceNote.trim() && !sourceName.trim()) {
      return setError("اكتب تفاصيل المصدر");
    }
    if (totalCost && (!Number.isFinite(Number(totalCost)) || Number(totalCost) < 0)) {
      return setError("التكلفة الإجمالية غير صالحة");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/seller/stock-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          sourceName: sourceName.trim() || null,
          sourcePhone: sourcePhone.trim() || null,
          sourceNote: sourceNote.trim() || null,
          totalCost: totalCost ? Number(totalCost) : null,
          invoiceUrl: invoice?.url ?? null,
          invoiceName: invoice?.name ?? null,
          items: items.map((x) => ({
            variantId: x.o.id,
            quantity: x.q,
            unitCost: cost[x.o.id] ? Number(cost[x.o.id]) : null,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || "تعذر الحفظ");
        return;
      }
      setDone({ status: json.receipt.status, added: json.receipt.added });
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="mx-auto max-w-md rounded-xl bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
          <p className="mt-3 text-sm font-bold text-red-700">{loadError}</p>
          <Link href="/seller/products" className="mt-4 inline-block rounded-lg bg-[#ff5c00] px-4 py-2 text-sm font-bold text-white">
            عودة للمنتجات
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="mx-auto max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
          <h2 className="mt-4 text-lg font-black text-gray-900">
            {done.status === "APPROVED" ? "تمت إضافة المخزون" : "أُرسل الطلب للموافقة"}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {done.status === "APPROVED"
              ? `أُضيفت ${done.added} قطعة إلى المخزون وسُجّلت في سجل الحركات.`
              : "لن تُحتسب الكمية ضمن المخزون القابل للبيع قبل أن يعتمدها صاحب المتجر."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/seller/products" className="rounded-lg bg-[#ff5c00] px-4 py-2 text-xs font-bold text-white">
              العودة للمنتجات
            </Link>
            <Link href="/seller/stock-receipts" className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700">
              طلبات المخزون
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 pb-24 pt-16 sm:px-4 lg:px-8 lg:pt-8">
      <Link
        href="/seller/products"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع إلى المنتجات
      </Link>

      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff4ed]">
          <PackagePlus className="h-5 w-5 text-[#ff5c00]" />
        </span>
        <div>
          <h1 className="text-xl font-black text-gray-900">إضافة مخزون</h1>
          <p className="text-sm text-gray-500">{name}</p>
        </div>
      </div>

      {!isOwner && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          سيُرسل هذا الطلب إلى صاحب المتجر للموافقة، ولن تُضاف الكمية إلى المخزون القابل للبيع قبل اعتماده.
        </div>
      )}

      <section className="mb-5 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-black text-gray-900">الكميات الواصلة</h2>
        <p className="mb-3 text-xs text-gray-500">
          أدخل الكمية الجديدة فقط لكل خيار، وستُضاف إلى الكمية الموجودة تلقائياً.
        </p>
        <div className="space-y-3">
          {options.map((o) => (
            <div key={o.id} className="rounded-lg border border-gray-100 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold text-gray-900">{o.label}</div>
                <div className="text-[11px] text-gray-500">
                  الحالي: <b>{o.stock}</b>
                  {o.reserved > 0 && <> · محجوز: {o.reserved}</>}
                  {o.defective > 0 && <> · معيب: {o.defective}</>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] font-bold text-gray-600">
                  الكمية الواصلة
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={qty[o.id] ?? ""}
                    onChange={(e) => setQty({ ...qty, [o.id]: e.target.value })}
                    className={`${inputCls} mt-1`}
                    placeholder="0"
                  />
                </label>
                <label className="text-[11px] font-bold text-gray-600">
                  تكلفة الوحدة (اختياري)
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={cost[o.id] ?? ""}
                    onChange={(e) => setCost({ ...cost, [o.id]: e.target.value })}
                    className={`${inputCls} mt-1`}
                    placeholder="د.م"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs font-bold text-gray-700">إجمالي القطع الواصلة: {totalQty}</div>
      </section>

      <section className="mb-5 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-black text-gray-900">مصدر المخزون</h2>
        <div className="space-y-3">
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={inputCls}>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} className={inputCls} placeholder="اسم الجهة (المورد أو الشركة أو المتجر)" maxLength={200} />
          <input value={sourcePhone} onChange={(e) => setSourcePhone(e.target.value)} className={inputCls} placeholder="هاتف الجهة (اختياري)" maxLength={40} inputMode="tel" />
          <textarea value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} className={inputCls} placeholder={sourceType === "OTHER" ? "تفاصيل المصدر (مطلوب)" : "ملاحظات (اختياري)"} rows={2} maxLength={1000} />
          <input type="number" min={0} step="0.01" inputMode="decimal" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} className={inputCls} placeholder="التكلفة الإجمالية للفاتورة بالدرهم (اختياري)" />
        </div>
      </section>

      <section className="mb-5 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-black text-gray-900">صورة الفاتورة أو وثيقة الإثبات</h2>
        {invoice ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            <span className="truncate">تم رفع: {invoice.name}</span>
            <button type="button" onClick={() => setInvoice(null)} className="font-bold underline">إزالة</button>
          </div>
        ) : (
          <DocumentUploader
            onSuccess={(f) => setInvoice({ url: f.url, name: f.name })}
            onError={(m) => setError(m)}
            disabled={submitting}
          />
        )}
      </section>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white p-3 lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff5c00] px-4 py-3 text-sm font-black text-white transition hover:bg-[#e64a00] disabled:opacity-60 lg:w-auto"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isOwner ? "إضافة إلى المخزون" : "إرسال للموافقة"}
        </button>
      </div>
    </div>
  );
}