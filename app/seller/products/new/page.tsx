"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Package,
  Save,
  AlertCircle,
} from "lucide-react";
import ImageUploader from "@/components/admin/ImageUploader";
import ProductOptionsEditor from "@/components/admin/ProductOptionsEditor";

type Category = { id: number; name: string };

export default function NewSellerProductPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [badge, setBadge] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [freeShipping, setFreeShipping] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const [selectedValues, setSelectedValues] = useState<Record<number, number[]>>({});
  const [variantData, setVariantData] = useState<
    Record<string, { price: number; stock: number }>
  >({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch("/api/seller/categories");
        const data = await res.json();
        if (data.success) {
          setCategories(data.categories);
          if (data.categories.length > 0) {
            setCategoryId(String(data.categories[0].id));
          }
        }
      } catch {
        // silent
      } finally {
        setLoadingCats(false);
      }
    }
    loadCategories();
  }, []);

  function handleNameChange(value: string) {
    setName(value);
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value));
    }
  }

  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 100);
  }

  function handleValuesChange(attributeId: number, valueIds: number[]) {
    setSelectedValues((prev) => ({ ...prev, [attributeId]: valueIds }));
  }

  function handleVariantChange(
    key: string,
    field: "price" | "stock",
    value: number
  ) {
    setVariantData((prev) => ({
      ...prev,
      [key]: {
        price: prev[key]?.price ?? 0,
        stock: prev[key]?.stock ?? 0,
        [field]: value,
      },
    }));
  }

  function handleCategoryChange(newId: string) {
    setCategoryId(newId);
    setSelectedValues({});
    setVariantData({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || name.trim().length < 2) {
      setError("اسم المنتج مطلوب (حرفين على الأقل)");
      return;
    }
    if (!slug.trim()) {
      setError("الرابط (slug) مطلوب");
      return;
    }
    if (!categoryId) {
      setError("اختر التصنيف");
      return;
    }
    if (!price || Number(price) <= 0) {
      setError("السعر مطلوب ويجب أن يكون أكبر من صفر");
      return;
    }
    if (imageUrls.length === 0) {
      setError("أضف صورة واحدة على الأقل");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/seller/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          brand: brand.trim() || null,
          badge: badge.trim() || null,
          categoryId: Number(categoryId),
          price: Number(price),
          oldPrice: oldPrice ? Number(oldPrice) : null,
          stock: Number(stock) || 0,
          freeShipping,
          imageUrls,
          selectedValues,
          variantData,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل إنشاء المنتج");
        return;
      }

      router.push("/seller/products");
      router.refresh();
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/seller/products"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع إلى منتجاتي
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">إضافة منتج جديد</h1>
        <p className="mt-1 text-sm text-gray-500">
          سيتم حفظ المنتج كـ"مسودة" حتى موافقة الإدارة
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-black">
                <Package className="h-4 w-4 text-[#ff5c00]" />
                معلومات المنتج
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    اسم المنتج <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="مثال: قميص رجالي كلاسيكي"
                    maxLength={200}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    الرابط (slug) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(generateSlug(e.target.value))}
                    placeholder="men-shirt-classic"
                    dir="ltr"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-[#ff5c00] focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    الوصف
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="وصف المنتج بالتفصيل..."
                    className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      الماركة
                    </label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="مثال: Nike"
                      maxLength={80}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      شارة المنتج
                    </label>
                    <input
                      type="text"
                      value={badge}
                      onChange={(e) => setBadge(e.target.value)}
                      placeholder="مثال: الأكثر مبيعاً"
                      maxLength={40}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <ProductOptionsEditor
              apiBase="/api/seller"
              categoryId={Number(categoryId) || null}
              selectedValues={selectedValues}
              variantData={variantData}
              defaultPrice={Number(price) || 0}
              defaultStock={Number(stock) || 0}
              onValuesChange={handleValuesChange}
              onVariantChange={handleVariantChange}
            />

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-black">السعر والمخزون</h2>
              <p className="mb-3 text-[11px] text-gray-500">
                قيم افتراضية للتركيبات التي لم تحدد لها سعراً/مخزوناً.
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    السعر <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="149"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    السعر القديم
                  </label>
                  <input
                    type="number"
                    value={oldPrice}
                    onChange={(e) => setOldPrice(e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="220"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    المخزون
                  </label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    min="0"
                    placeholder="50"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  />
                </div>
              </div>

              <label className="mt-3 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={freeShipping}
                  onChange={(e) => setFreeShipping(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#ff5c00] focus:ring-[#ff5c00]"
                />
                <span className="text-xs font-bold text-gray-700">
                  شحن مجاني لهذا المنتج
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-1">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-black">
                التصنيف <span className="text-red-500">*</span>
              </h2>

              {loadingCats ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-[#ff5c00]" />
                </div>
              ) : (
                <select
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-black">
                صور المنتج <span className="text-red-500">*</span>
              </h2>
              <ImageUploader
                value={imageUrls}
                onChange={(urls) => setImageUrls(urls)}
              />
              <p className="mt-2 text-[10px] text-gray-400">
                الصورة الأولى ستكون الرئيسية
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#e64a00] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            حفظ المنتج
          </button>
          <Link
            href="/seller/products"
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            إلغاء
          </Link>
        </div>
      </form>
    </div>
  );
}