"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Plus, X, Image as ImageIcon, Package } from "lucide-react";

type Category = { id: number; name: string };
type VariantInput = { sku: string; barcode: string; options: { key: string; value: string }[] };

export default function NewMasterPage() {
  const params = useParams();
  const router = useRouter();
  const bizId = parseInt(params.id as string);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [barcode, setBarcode] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [variants, setVariants] = useState<VariantInput[]>([{ sku: "", barcode: "", options: [] }]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/categories");
        if (res.ok) {
          const d = await res.json();
          const list = Array.isArray(d) ? d : d.categories || d.items || [];
          setCategories(list);
          if (list.length > 0) setCategoryId(list[0].id);
        }
      } catch {}
    })();
  }, []);

  function addImage() {
    const url = newImageUrl.trim();
    if (!url) return;
    if (!url.startsWith("http")) return setError("الرابط يجب أن يبدأ بـ http");
    setImages([...images, url]);
    setNewImageUrl("");
  }

  function removeImage(i: number) { setImages(images.filter((_, idx) => idx !== i)); }

  function addVariant() {
    setVariants([...variants, { sku: "", barcode: "", options: [] }]);
  }

  function removeVariant(i: number) {
    if (variants.length === 1) return;
    setVariants(variants.filter((_, idx) => idx !== i));
  }

  function updateVariant(i: number, field: "sku" | "barcode", value: string) {
    const copy = [...variants];
    copy[i] = { ...copy[i], [field]: value };
    setVariants(copy);
  }

  function addOptionToVariant(i: number) {
    const copy = [...variants];
    copy[i].options.push({ key: "", value: "" });
    setVariants(copy);
  }

  function updateOption(vi: number, oi: number, field: "key" | "value", value: string) {
    const copy = [...variants];
    copy[vi].options[oi] = { ...copy[vi].options[oi], [field]: value };
    setVariants(copy);
  }

  function removeOption(vi: number, oi: number) {
    const copy = [...variants];
    copy[vi].options = copy[vi].options.filter((_, idx) => idx !== oi);
    setVariants(copy);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("اسم المنتج مطلوب");
    if (!categoryId) return setError("اختر تصنيفًا");
    if (images.length === 0) return setError("أضف صورة واحدة على الأقل");

    const preparedVariants = variants.map((v) => {
      const opts: Record<string, string> = {};
      for (const o of v.options) {
        if (o.key.trim() && o.value.trim()) opts[o.key.trim()] = o.value.trim();
      }
      return {
        sku: v.sku.trim() || null,
        barcode: v.barcode.trim() || null,
        options: Object.keys(opts).length > 0 ? opts : null,
      };
    });

    // Check duplicates in options
    const hashes = preparedVariants.map((v) => {
      if (!v.options) return "__default__";
      return Object.keys(v.options).sort().map(k => `${k}=${v.options![k]}`).join("|");
    });
    if (new Set(hashes).size !== hashes.length) return setError("يوجد تكرار في خيارات المتغيرات");

    setLoading(true);
    try {
      const body: any = {
        name: name.trim(),
        categoryId,
        images,
        variants: preparedVariants,
      };
      if (brand.trim()) body.brand = brand.trim();
      if (description.trim()) body.description = description.trim();
      if (barcode.trim()) body.barcode = barcode.trim();
      if (qrCode.trim()) body.qrCode = qrCode.trim();

      const res = await fetch(`/api/business/${bizId}/masters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.success) router.push(`/business/${bizId}/masters/${d.master.id}`);
      else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/business/${bizId}/masters`} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold">منتج جديد</h1>
          <p className="text-sm text-gray-600">سيُرسل للتوثيق قبل ظهوره في السوق</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl bg-white border p-5 space-y-4">
          <h2 className="font-semibold">المعلومات الأساسية</h2>
          <div>
            <label className="block text-sm font-medium mb-1">اسم المنتج *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border p-2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">التصنيف *</label>
              <select value={categoryId ?? ""} onChange={(e) => setCategoryId(parseInt(e.target.value))} className="w-full rounded-lg border p-2">
                <option value="">اختر</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">العلامة التجارية</label>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full rounded-lg border p-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">الوصف</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border p-2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">الباركود</label>
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="w-full rounded-lg border p-2 font-mono text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">رمز QR</label>
              <input value={qrCode} onChange={(e) => setQrCode(e.target.value)} className="w-full rounded-lg border p-2 font-mono text-sm" />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white border p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><ImageIcon className="h-5 w-5" /> الصور *</h2>
          <div className="flex gap-2">
            <input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="https://..." className="flex-1 rounded-lg border p-2 text-sm" />
            <button type="button" onClick={addImage} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"><Plus className="h-4 w-4" /></button>
          </div>
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {images.map((url, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden border aspect-square">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 rounded bg-red-500 text-white p-1"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">المتغيرات * ({variants.length})</h2>
            <button type="button" onClick={addVariant} className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 flex items-center gap-1"><Plus className="h-4 w-4" /> إضافة</button>
          </div>
          {variants.map((v, vi) => (
            <div key={vi} className="rounded-lg border p-3 space-y-2 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">متغير #{vi + 1}</p>
                {variants.length > 1 && (
                  <button type="button" onClick={() => removeVariant(vi)} className="text-red-500 text-xs">حذف</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={v.sku} onChange={(e) => updateVariant(vi, "sku", e.target.value)} placeholder="SKU" className="rounded border p-2 text-sm font-mono" />
                <input value={v.barcode} onChange={(e) => updateVariant(vi, "barcode", e.target.value)} placeholder="باركود" className="rounded border p-2 text-sm font-mono" />
              </div>
              {v.options.length > 0 && (
                <div className="space-y-1">
                  {v.options.map((o, oi) => (
                    <div key={oi} className="flex gap-2">
                      <input value={o.key} onChange={(e) => updateOption(vi, oi, "key", e.target.value)} placeholder="الخاصية (مثل: اللون)" className="flex-1 rounded border p-1.5 text-xs" />
                      <input value={o.value} onChange={(e) => updateOption(vi, oi, "value", e.target.value)} placeholder="القيمة (مثل: أحمر)" className="flex-1 rounded border p-1.5 text-xs" />
                      <button type="button" onClick={() => removeOption(vi, oi)} className="rounded border px-2 text-red-500"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => addOptionToVariant(vi)} className="text-xs text-orange-600 hover:underline">+ إضافة خاصية</button>
            </div>
          ))}
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3">
          <Link href={`/business/${bizId}/masters`} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">إلغاء</Link>
          <button type="submit" disabled={loading} className="rounded-lg bg-orange-500 px-6 py-2 text-white text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "جارٍ الإنشاء..." : "إنشاء المنتج"}
          </button>
        </div>
      </form>
    </div>
  );
}