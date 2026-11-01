"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Package, ArrowLeft, Store, Import as ImportIcon, X, AlertCircle, CheckCircle2 } from "lucide-react";

type InventoryItem = {
  id: number;
  businessId: number;
  masterId: number;
  masterVariantId: number;
  quantity: number;
  quantityReserved: number;
  lastUnitCost: number;
  lastSourceBusinessId: number | null;
  updatedAt: string;
  master: { id: number; name: string; brand: string | null; images: string[]; categoryId: number };
  masterVariant: { id: number; sku: string | null; barcode: string | null; options: any; optionsHash: string };
};

type Meta = {
  businessType: string;
  linkedSeller: { id: number; storeName: string; isVerified: boolean; slug: string } | null;
  canImport: boolean;
};

export default function InventoryPage() {
  const params = useParams();
  const router = useRouter();
  const bizId = parseInt(params.id as string);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [importQty, setImportQty] = useState("");
  const [importPrice, setImportPrice] = useState("");
  const [importing, setImporting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/business/${bizId}/inventory`);
      const d = await res.json();
      if (d.success) {
        setItems(d.items);
        setMeta(d.meta);
      } else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [bizId]);

  function openImport(item: InventoryItem) {
    setSelected(item);
    setImportQty(String(item.quantity));
    setImportPrice("");
    setError("");
    setSuccess("");
  }

  async function handleImport() {
    if (!selected) return;
    const qty = parseInt(importQty);
    const price = parseFloat(importPrice);
    if (!qty || qty <= 0) return setError("الكمية يجب أن تكون أكبر من صفر");
    if (qty > selected.quantity) return setError(`الحد الأقصى ${selected.quantity}`);
    if (!price || price <= 0) return setError("سعر التجزئة مطلوب");
    setImporting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/business/${bizId}/inventory/${selected.masterVariantId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty, retailPrice: price }),
      });
      const d = await res.json();
      if (d.success) {
        setSuccess(`تم نقل ${qty} وحدة إلى متجر التجزئة${d.productCreated ? " (منتج جديد)" : " (منتج موجود)"}`);
        setSelected(null);
        await load();
      } else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setImporting(false); }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/business/${bizId}`} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">مخزون الجملة</h1>
          <p className="text-sm text-gray-600">{items.length} منتج · {items.reduce((s, i) => s + i.quantity, 0)} وحدة</p>
        </div>
      </div>

      {meta && !meta.canImport && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">لا يمكنك الاستيراد للتجزئة حاليًا</p>
              <p className="text-xs mt-1">
                {meta.businessType !== "WHOLESALE_TRADER" && "الاستيراد متاح لحسابات تجار الجملة فقط."}
                {meta.businessType === "WHOLESALE_TRADER" && !meta.linkedSeller && "يجب ربط متجر تجزئة بهذا النشاط."}
                {meta.businessType === "WHOLESALE_TRADER" && meta.linkedSeller && !meta.linkedSeller.isVerified && "متجر التجزئة غير موثق."}
              </p>
            </div>
          </div>
        </div>
      )}

      {meta && meta.canImport && meta.linkedSeller && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800 flex items-center gap-2">
          <Store className="h-5 w-5" />
          <span>متجر التجزئة المرتبط: <strong>{meta.linkedSeller.storeName}</strong></span>
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{success}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white border p-12 text-center">
          <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold mb-2">مخزونك فارغ</h2>
          <p className="text-sm text-gray-600 mb-6">اشترِ منتجات من سوق الجملة لتظهر هنا</p>
          <Link href="/marketplace" className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3 text-white hover:bg-orange-600">
            تصفح سوق الجملة
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="rounded-xl bg-white border p-4">
              <div className="flex gap-4">
                <div className="h-20 w-20 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  {it.master.images?.[0] ? (
                    <img src={it.master.images[0]} alt={it.master.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400"><Package className="h-8 w-8" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{it.master.name}</h3>
                  {it.master.brand && <p className="text-xs text-gray-500">{it.master.brand}</p>}
                  <p className="text-sm text-gray-600 mt-1">
                    {it.masterVariant.options ? Object.entries(it.masterVariant.options).map(([k, v]) => `${k}: ${v}`).join(" / ") : "—"}
                  </p>
                  {it.masterVariant.sku && <p className="text-xs text-gray-500 font-mono">{it.masterVariant.sku}</p>}
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">الكمية</p>
                  <p className="text-2xl font-bold text-orange-600">{it.quantity}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">تكلفة الوحدة</p>
                  <p className="text-lg font-semibold">{Number(it.lastUnitCost)} د.م</p>
                </div>
                <div className="flex items-center">
                  <button
                    onClick={() => openImport(it)}
                    disabled={!meta?.canImport}
                    className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <ImportIcon className="h-4 w-4" /> استيراد للتجزئة
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">استيراد للتجزئة</h2>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></button>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-medium">{selected.master.name}</p>
              <p className="text-xs text-gray-600 mt-1">
                {selected.masterVariant.options ? Object.entries(selected.masterVariant.options).map(([k, v]) => `${k}: ${v}`).join(" / ") : ""}
              </p>
              <p className="text-xs text-gray-500 mt-1">المخزون المتاح: {selected.quantity}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الكمية المراد استيرادها *</label>
              <input type="number" min="1" max={selected.quantity} value={importQty}
                onChange={(e) => setImportQty(e.target.value)} className="w-full rounded-lg border p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">سعر التجزئة *</label>
              <input type="number" step="0.01" value={importPrice}
                onChange={(e) => setImportPrice(e.target.value)} placeholder="مثال: 65" className="w-full rounded-lg border p-2" />
              <p className="text-xs text-gray-500 mt-1">سيُستخدم هذا السعر في متجر التجزئة</p>
            </div>
            {error && <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">{error}</div>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setSelected(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">إلغاء</button>
              <button onClick={handleImport} disabled={importing}
                className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
                {importing && <Loader2 className="h-4 w-4 animate-spin" />} <ImportIcon className="h-4 w-4" /> استيراد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}