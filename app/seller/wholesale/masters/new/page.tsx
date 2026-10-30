"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Package, Barcode, Search, AlertCircle,
  CheckCircle2, Image as ImageIcon,
} from "lucide-react";
import ImageUploader from "@/components/admin/ImageUploader";

type Category = {
  id: number;
  name: string;
  parentId: number | null;
  level: number;
  isLeaf: boolean;
};

type LookupResult = {
  found: boolean;
  master?: {
    id: number;
    name: string;
    barcode: string | null;
  };
};

type Step = 1 | 2 | 3;

export default function NewMasterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledBarcode = searchParams.get("barcode") || "";

  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  const [barcode, setBarcode] = useState(prefilledBarcode);
  const [checking, setChecking] = useState(false);
  const [existingMaster, setExistingMaster] = useState<LookupResult["master"] | null>(null);
  const [barcodeChecked, setBarcodeChecked] = useState(false);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [parentCategoryId, setParentCategoryId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/seller/categories");
        const d = await res.json();
        if (d.success) setCategories(d.categories);
      } finally { setLoadingCats(false); }
    })();
  }, []);

  useEffect(() => {
    if (prefilledBarcode) {
      checkBarcode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkBarcode() {
    if (!barcode.trim() || barcode.trim().length < 3) {
      setError("الباركود قصير جدًا");
      return;
    }
    setChecking(true); setError(""); setExistingMaster(null);
    try {
      const res = await fetch("/api/products/master/lookup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: barcode.trim(), codeType: "BARCODE" }),
      });
      const d = await res.json();
      if (d.success && d.found) {
        setExistingMaster(d.master);
      } else {
        setExistingMaster(null);
      }
      setBarcodeChecked(true);
    } catch { setError("خطأ في الاتصال"); }
    finally { setChecking(false); }
  }

  function proceedToStep2() {
    if (existingMaster) {
      setError("هذا الباركود مسجل بالفعل. لا يمكن إنشاء هوية مكررة. استخدم المنتج الموجود.");
      return;
    }
    setError(""); setStep(2);
  }

  function proceedToStep3() {
    if (!name.trim() || name.trim().length < 2) { setError("الاسم مطلوب"); return; }
    if (!categoryId) { setError("اختر الفئة الفرعية"); return; }
    setError(""); setStep(3);
  }

  async function submit() {
    if (imageUrls.length === 0) { setError("أضف صورة واحدة على الأقل"); return; }
    setError(""); setSaving(true);
    try {
      const res = await fetch("/api/products/master", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          brand: brand.trim() || null,
          description: description.trim() || null,
          categoryId: parseInt(categoryId),
          barcode: barcode.trim() || null,
          images: imageUrls,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        if (d.existingMasterId) {
          setError(`${d.message} — يمكنك استخدام المنتج الموجود.`);
          return;
        }
        setError(d.message || "فشل");
        return;
      }
      router.push("/seller/wholesale/masters");
    } catch { setError("خطأ في الاتصال"); }
    finally { setSaving(false); }
  }

  const rootCats = categories.filter((c) => c.parentId === null);
  const childCats = parentCategoryId
    ? categories.filter((c) => c.parentId === parseInt(parentCategoryId))
    : [];

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mx-auto max-w-2xl">
        <Link href="/seller/wholesale/masters" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]">
          <ArrowLeft className="h-3.5 w-3.5" /> عودة للهويات
        </Link>
        <h1 className="mb-1 text-2xl font-black">هوية منتج جديدة</h1>
        <p className="mb-6 text-sm text-gray-500">
          المرحلة {step} من 3 — {step === 1 ? "الباركود" : step === 2 ? "المعلومات" : "الصور"}
        </p>

        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <label className="mb-2 flex items-center gap-2 text-sm font-bold">
                <Barcode className="h-4 w-4 text-[#ff5c00]" /> الباركود (اختياري)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => { setBarcode(e.target.value); setBarcodeChecked(false); setExistingMaster(null); }}
                  onKeyDown={(e) => e.key === "Enter" && checkBarcode()}
                  placeholder="امسح أو اكتب الباركود..."
                  dir="ltr"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-[#ff5c00]"
                />
                <button
                  onClick={checkBarcode}
                  disabled={checking || !barcode.trim()}
                  className="rounded-lg bg-[#ff5c00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e64a00] disabled:opacity-50"
                >
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "تحقق"}
                </button>
              </div>

              {existingMaster && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2 text-xs text-amber-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <strong>المنتج موجود بالفعل:</strong> {existingMaster.name}
                      <div className="mt-1">لا يمكن إنشاء نسخة مكررة. استخدم المنتج الموجود لعرضه بالجملة.</div>
                      <Link
                        href={`/wholesale/master/${existingMaster.id}`}
                        className="mt-2 inline-block rounded bg-amber-700 px-3 py-1 text-[10px] font-bold text-white"
                      >
                        عرض المنتج الموجود
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {barcodeChecked && !existingMaster && (
                <div className="mt-3 rounded-lg bg-green-50 p-3 text-xs font-bold text-green-800">
                  ✅ الباركود متاح — يمكنك المتابعة
                </div>
              )}

              {!barcode.trim() && (
                <p className="mt-3 text-[10px] text-gray-500">
                  💡 بدون باركود ستُنشئ هوية يدوية. يمكنك ربطها بباركود لاحقًا من التعديل.
                </p>
              )}
            </div>

            {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}

            <div className="flex gap-2">
              <Link href="/seller/wholesale/masters" className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-bold">إلغاء</Link>
              <button
                onClick={proceedToStep2}
                disabled={existingMaster !== null || (barcode.trim().length > 0 && !barcodeChecked)}
                className="flex-1 rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white hover:bg-[#e64a00] disabled:opacity-50"
              >
                التالي
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-5 shadow-sm space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold">اسم المنتج *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: قميص رجالي كلاسيكي" maxLength={200} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">الماركة</label>
                <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Nike" maxLength={80} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">الوصف</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">الفئة الرئيسية *</label>
                <select value={parentCategoryId} onChange={(e) => { setParentCategoryId(e.target.value); setCategoryId(""); }} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]">
                  <option value="">— اختر —</option>
                  {rootCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {parentCategoryId && (
                <div>
                  <label className="mb-1 block text-xs font-bold">الفئة الفرعية *</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]">
                    <option value="">— اختر —</option>
                    {childCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-bold">السابق</button>
              <button onClick={proceedToStep3} className="flex-1 rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white hover:bg-[#e64a00]">التالي</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <label className="mb-3 flex items-center gap-2 text-sm font-bold">
                <ImageIcon className="h-4 w-4 text-[#ff5c00]" /> صور المنتج *
              </label>
              <ImageUploader value={imageUrls} onChange={(urls) => setImageUrls(urls)} />
              <p className="mt-2 text-[10px] text-gray-500">الصورة الأولى ستكون الرئيسية</p>
            </div>

            {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-bold">السابق</button>
              <button onClick={submit} disabled={saving || imageUrls.length === 0} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} حفظ الهوية
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}