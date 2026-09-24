"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, Package, Plus } from "lucide-react";

type Category = { id: number; name: string };

type NewProductFormProps = {
  categories: Category[];
};

export default function NewProductForm({ categories }: NewProductFormProps) {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    brand: "",
    badge: "",
    categoryId: categories[0]?.id?.toString() || "",
    price: "",
    oldPrice: "",
    stock: "0",
    imageUrl: "",
    freeShipping: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function generateSlug(name: string) {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 60);
  }

  function updateField(field: string, value: any) {
    setForm((f) => ({ ...f, [field]: value }));

    if (field === "name" && !form.slug) {
      setForm((f) => ({ ...f, slug: generateSlug(value) }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || form.name.length < 2) {
      setError("اسم المنتج مطلوب");
      return;
    }
    if (!form.slug.trim()) {
      setError("الرابط (slug) مطلوب");
      return;
    }
    if (!form.categoryId) {
      setError("التصنيف مطلوب");
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      setError("السعر مطلوب");
      return;
    }
    if (!form.imageUrl.trim()) {
      setError("صورة المنتج مطلوبة");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          description: form.description,
          brand: form.brand,
          badge: form.badge,
          categoryId: parseInt(form.categoryId),
          price: Number(form.price),
          oldPrice: form.oldPrice ? Number(form.oldPrice) : undefined,
          stock: Number(form.stock) || 0,
          imageUrl: form.imageUrl,
          freeShipping: form.freeShipping,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل إنشاء المنتج");
        setLoading(false);
        return;
      }

      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("فشل الاتصال بالخادم");
      setLoading(false);
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/admin/products"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للمنتجات
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">إضافة منتج جديد</h1>
        <p className="mt-1 text-sm text-gray-500">
          املأ الحقول التالية لإضافة منتج للمتجر
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
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="مثلاً: قميص رجالي كلاسيكي"
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
                    value={form.slug}
                    onChange={(e) => updateField("slug", e.target.value)}
                    placeholder="men-shirt-classic"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-[#ff5c00] focus:bg-white"
                    dir="ltr"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    الوصف
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="وصف تفصيلي للمنتج..."
                    rows={3}
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
                      value={form.brand}
                      onChange={(e) => updateField("brand", e.target.value)}
                      placeholder="Nokhba Basics"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      الشارة
                    </label>
                    <input
                      type="text"
                      value={form.badge}
                      onChange={(e) => updateField("badge", e.target.value)}
                      placeholder="جديد، الأكثر مبيعاً..."
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-black">السعر والمخزون</h2>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    السعر (د.م) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => updateField("price", e.target.value)}
                    placeholder="149"
                    min="0"
                    step="0.01"
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
                    value={form.oldPrice}
                    onChange={(e) => updateField("oldPrice", e.target.value)}
                    placeholder="220"
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    المخزون
                  </label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) => updateField("stock", e.target.value)}
                    placeholder="50"
                    min="0"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  />
                </div>
              </div>

              <label className="mt-3 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.freeShipping}
                  onChange={(e) => updateField("freeShipping", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#ff5c00] focus:ring-[#ff5c00]"
                />
                <span className="text-xs font-bold text-gray-700">
                  شحن مجاني
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-1">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-black">
                التصنيف <span className="text-red-500">*</span>
              </h2>
              <select
                value={form.categoryId}
                onChange={(e) => updateField("categoryId", e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-black">
                صورة المنتج <span className="text-red-500">*</span>
              </h2>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => updateField("imageUrl", e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-[#ff5c00] focus:bg-white"
                dir="ltr"
                required
              />

              {form.imageUrl && (
                <div className="mt-3 aspect-square overflow-hidden rounded-lg bg-gray-100">
                  <img
                    src={form.imageUrl}
                    alt="معاينة"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
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
              <Plus className="h-4 w-4" />
            )}
            إضافة المنتج
          </button>
          <Link
            href="/admin/products"
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            إلغاء
          </Link>
        </div>
      </form>
    </div>
  );
}