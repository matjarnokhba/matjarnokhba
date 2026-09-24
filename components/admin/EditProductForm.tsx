"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Package,
  Save,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import ImageUploader from "./ImageUploader";

type Category = { id: number; name: string };

type InitialData = {
  id: number;
  name: string;
  slug: string;
  description: string;
  brand: string;
  badge: string;
  categoryId: string;
  price: string;
  oldPrice: string;
  stock: string;
  imageUrls: string[];
  freeShipping: boolean;
};

type EditProductFormProps = {
  initialData: InitialData;
  categories: Category[];
};

export default function EditProductForm({
  initialData,
  categories,
}: EditProductFormProps) {
  const router = useRouter();

  const [form, setForm] = useState({
    name: initialData.name,
    slug: initialData.slug,
    description: initialData.description,
    brand: initialData.brand,
    badge: initialData.badge,
    categoryId: initialData.categoryId,
    price: initialData.price,
    oldPrice: initialData.oldPrice,
    stock: initialData.stock,
    imageUrls: initialData.imageUrls,
    freeShipping: initialData.freeShipping,
  });

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function updateField(field: string, value: any) {
    setForm((f) => ({ ...f, [field]: value }));
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!form.name.trim() || form.name.length < 2) {
      setError("اسم المنتج مطلوب");
      return;
    }
    if (!form.slug.trim()) {
      setError("الرابط (slug) مطلوب");
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      setError("السعر مطلوب");
      return;
    }
    if (form.imageUrls.length === 0) {
      setError("صورة واحدة على الأقل مطلوبة");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/admin/products/${initialData.id}`, {
        method: "PATCH",
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
          imageUrls: form.imageUrls,
          freeShipping: form.freeShipping,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحديث");
        setLoading(false);
        return;
      }

      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/products/${initialData.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل الحذف");
        setDeleting(false);
        return;
      }

      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("فشل الاتصال بالخادم");
      setDeleting(false);
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

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">تعديل المنتج</h1>
          <p className="mt-1 text-sm text-gray-500">{initialData.name}</p>
        </div>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
          حذف المنتج
        </button>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl">
        <div className="grid gap-4 lg:grid-cols-3">
          {/* اليسار */}
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
                    السعر <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => updateField("price", e.target.value)}
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

          {/* اليمين */}
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
              <ImageUploader
                value={form.imageUrls}
                onChange={(urls) => updateField("imageUrls", urls)}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            ✓ تم حفظ التغييرات بنجاح
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
            حفظ التغييرات
          </button>
          <Link
            href="/admin/products"
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            إلغاء
          </Link>
        </div>
      </form>

      {/* نافذة تأكيد الحذف */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-7 w-7 text-red-600" />
            </div>
            <h3 className="mt-4 text-lg font-black">تأكيد الحذف</h3>
            <p className="mt-2 text-sm text-gray-600">
              هل أنت متأكد من حذف "{initialData.name}"؟
              <br />
              <span className="text-xs text-gray-400">
                (سيتم تعطيله وليس حذفه نهائياً)
              </span>
            </p>
            <div className="mt-6 flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                نعم، احذف
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}